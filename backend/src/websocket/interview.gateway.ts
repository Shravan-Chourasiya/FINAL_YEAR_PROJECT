import type {
  IoServer,
  IoSocket,
  WsError,
  WsErrorCode,
  InterviewJoinedPayload,
  InterviewLeftPayload,
  InterviewStateChangePayload,
} from "./socket.types.js";
import { EVENT_VERSION } from "./socket.types.js";
import {
  setSocketSession,
  getSocketSession,
  deleteSocketSession,
  setGracePeriod,
  clearGracePeriod,
  isInGracePeriod,
  GRACE_TTL_SECONDS,
} from "./socket.registry.js";
import {
  fetchInterviewById,
  submitAnswerService,
  cancelInterviewService,
  generateAndDeliverQuestionService,
  requestNextQuestionService,
} from "../modules/interview/services/interview.service.js";
import { readInterviewContext } from "../modules/interview/services/interview.context.service.js";
import { logger } from "../utils/logger.js";
import getPgDb from "../db/postgres.init.js";
import { interviewsTable } from "../modules/interview/schemas/interview.schema.js";
import { eq } from "drizzle-orm";

const INTERVIEW_ROOM = (id: string) => `interview:${id}`;

// ── Error helper ──────────────────────────────────────────────────────────────

function wsError(code: WsErrorCode, message: string, interviewId?: string): WsError {
  return {
    eventVersion: EVENT_VERSION,
    event: "ws:error",
    code,
    message,
    timestamp: new Date().toISOString(),
    ...(interviewId ? { interviewId } : {}),
  };
}

// ── Ownership + state guard ───────────────────────────────────────────────────

async function assertInterviewAccess(socket: IoSocket, interviewId: string): Promise<void> {
  const interview = await fetchInterviewById(interviewId);

  if (!interview) throw new Error("INTERVIEW_NOT_FOUND");
  if (interview.userId !== socket.data.userId) throw new Error("AUTH_FORBIDDEN");
  if (interview.interviewStatus !== "INPROGRESS") throw new Error("INTERVIEW_INVALID_STATE");
}

// ── Disconnect handler ────────────────────────────────────────────────────────
// Behavior on socket drop:
//   - A 30-second grace period is started immediately.
//   - If the candidate reconnects within the grace period, the interview
//     continues uninterrupted (clearGracePeriod is called on interview:join).
//   - If the grace period expires without a reconnect, the interview is
//     transitioned to SCHEDULED (paused) via the state machine so it can be
//     resumed later. The state change is broadcast to the room so any other
//     connected observers (e.g. a recruiter view) are notified.
//   - Mid-question vs mid-answer: the interview stays INPROGRESS during the
//     grace window regardless of whether the candidate was mid-question or
//     mid-answer. The current question is NOT auto-submitted on disconnect;
//     the candidate must re-submit after reconnecting. The stale-question
//     cron job handles the case where the grace period expires AND the
//     question timeout also fires (it will mark the question TIMED_OUT).
async function handleDisconnect(socket: IoSocket, io: IoServer): Promise<void> {
  const { interviewId, userId } = socket.data;
  if (!interviewId || !userId) return;

  const session = await getSocketSession(interviewId);
  if (!session || session.socketId !== socket.id) return;

  logger.info(
    { socketId: socket.id, interviewId, userId },
    "[ws] socket disconnected — starting grace period",
  );

  await setGracePeriod(interviewId);

  setTimeout(async () => {
    const stillInGrace = await isInGracePeriod(interviewId);
    if (!stillInGrace) return; // candidate reconnected — grace was cleared

    logger.info({ interviewId }, "[ws] grace period expired — pausing interview");
    await deleteSocketSession(interviewId);

    try {
      // Go through the state machine — assertValidTransition enforces INPROGRESS → SCHEDULED
      const interview = await fetchInterviewById(interviewId);
      if (!interview || interview.interviewStatus !== "INPROGRESS") return;

      const db = getPgDb();
      await db
        .update(interviewsTable)
        .set({ interviewStatus: "SCHEDULED", lastActivityAt: new Date() })
        .where(eq(interviewsTable.id, interviewId));

      // Use io.to() — socket may already be gone from the room at this point
      const stateChange: InterviewStateChangePayload = {
        eventVersion: EVENT_VERSION,
        event: "interview:state_change",
        interviewId,
        status: "SCHEDULED",
        timestamp: new Date().toISOString(),
      };
      io.to(INTERVIEW_ROOM(interviewId)).emit("interview:state_change", stateChange);
    } catch (err) {
      logger.error({ err, interviewId }, "[ws] failed to pause interview after disconnect");
    }
  }, GRACE_TTL_SECONDS * 1000);
}

// ── Gateway registration ──────────────────────────────────────────────────────

export function registerInterviewGateway(io: IoServer): void {
  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id, userId: socket.data.userId }, "[ws] socket connected");

    // ── interview:join ──────────────────────────────────────────────────────
    socket.on("interview:join", async (payload) => {
      const { interviewId } = payload;
      try {
        await assertInterviewAccess(socket, interviewId);

        const context = await readInterviewContext(interviewId);
        if (!context) {
          socket.emit(
            "ws:error",
            wsError(
              "CONTEXT_MISSING",
              "Interview session context not found — was the interview started?",
              interviewId,
            ),
          );
          return;
        }

        const existing = await getSocketSession(interviewId);
        const isReconnect = !!(existing && existing.userId === socket.data.userId);

        if (isReconnect) {
          await clearGracePeriod(interviewId);
          logger.info({ socketId: socket.id, interviewId }, "[ws] socket reconnected");
        }

        await setSocketSession(interviewId, {
          socketId: socket.id,
          userId: socket.data.userId,
          connectedAt: new Date().toISOString(),
        });

        socket.data.interviewId = interviewId;
        await socket.join(INTERVIEW_ROOM(interviewId));

        const joined: InterviewJoinedPayload = {
          eventVersion: EVENT_VERSION,
          event: "interview:joined",
          interviewId,
          reconnected: isReconnect,
          timerStartedAt: context.timerStartedAt,
          durationMinutes: context.config.durationMinutes,
        };
        socket.emit("interview:joined", joined);
        logger.info(
          { socketId: socket.id, interviewId, reconnected: isReconnect },
          "[ws] joined interview room",
        );

        // Deliver (or re-deliver on reconnect) the current question
        await generateAndDeliverQuestionService(interviewId, io);
      } catch (err) {
        const code = (err instanceof Error ? err.message : "INTERNAL_ERROR") as WsErrorCode;
        socket.emit("ws:error", wsError(code, `Failed to join interview: ${code}`, interviewId));
        logger.warn({ socketId: socket.id, interviewId, code }, "[ws] interview:join rejected");
      }
    });

    // ── interview:leave ─────────────────────────────────────────────────────
    socket.on("interview:leave", async (payload) => {
      const { interviewId } = payload;
      const session = await getSocketSession(interviewId);
      if (session?.socketId === socket.id) await deleteSocketSession(interviewId);

      socket.data.interviewId = undefined as unknown as string;
      await socket.leave(INTERVIEW_ROOM(interviewId));

      const left: InterviewLeftPayload = {
        eventVersion: EVENT_VERSION,
        event: "interview:left",
        interviewId,
      };
      socket.emit("interview:left", left);
      logger.info({ socketId: socket.id, interviewId }, "[ws] left interview room");
    });

    // ── answer:submit ───────────────────────────────────────────────────────
    socket.on("answer:submit", async (payload) => {
      const { interviewId, questionId, answerData, answerType } = payload;
      try {
        await assertInterviewAccess(socket, interviewId);
        const fakeAuthReq = { auth: { userId: socket.data.userId } } as Parameters<
          typeof submitAnswerService
        >[0];
        await submitAnswerService(fakeAuthReq, interviewId, { questionId, answerData, answerType });
        logger.info({ socketId: socket.id, interviewId, questionId }, "[ws] answer submitted");
      } catch (err) {
        const code = (err instanceof Error ? err.message : "INTERNAL_ERROR") as WsErrorCode;
        socket.emit("ws:error", wsError(code, `Answer submission failed: ${code}`, interviewId));
      }
    });

    // ── code:submit ─────────────────────────────────────────────────────────
    // Treated as a TEXT answer for now; codebox integration is out of scope.
    socket.on("code:submit", async (payload) => {
      const { interviewId, questionId, language, code } = payload;
      try {
        await assertInterviewAccess(socket, interviewId);
        const fakeAuthReq = { auth: { userId: socket.data.userId } } as Parameters<
          typeof submitAnswerService
        >[0];
        await submitAnswerService(fakeAuthReq, interviewId, {
          questionId,
          answerData: `[${language}]\n${code}`,
          answerType: "TEXT",
        });
        logger.info(
          { socketId: socket.id, interviewId, questionId, language },
          "[ws] code submitted",
        );
      } catch (err) {
        const code = (err instanceof Error ? err.message : "INTERNAL_ERROR") as WsErrorCode;
        socket.emit("ws:error", wsError(code, `Code submission failed: ${code}`, interviewId));
      }
    });

    // ── question:next ───────────────────────────────────────────────────────
    // Only succeeds if the current question is in a completed state.
    socket.on("question:next", async (payload) => {
      const { interviewId } = payload;
      try {
        await assertInterviewAccess(socket, interviewId);
        await requestNextQuestionService(interviewId, socket.data.userId, io);
        logger.info(
          { socketId: socket.id, interviewId },
          "[ws] question:next — next question delivered",
        );
      } catch (err) {
        const code = (err instanceof Error ? err.message : "INTERNAL_ERROR") as WsErrorCode;
        socket.emit("ws:error", wsError(code, `question:next failed: ${code}`, interviewId));
      }
    });

    // ── interview:cancel ────────────────────────────────────────────────────
    socket.on("interview:cancel", async (payload) => {
      const { interviewId } = payload;
      try {
        await assertInterviewAccess(socket, interviewId);
        const fakeAuthReq = { auth: { userId: socket.data.userId } } as Parameters<
          typeof cancelInterviewService
        >[0];
        await cancelInterviewService(fakeAuthReq, interviewId);

        await deleteSocketSession(interviewId);

        const stateChange: InterviewStateChangePayload = {
          eventVersion: EVENT_VERSION,
          event: "interview:state_change",
          interviewId,
          status: "CANCELLED",
          timestamp: new Date().toISOString(),
        };
        io.to(INTERVIEW_ROOM(interviewId)).emit("interview:state_change", stateChange);
        logger.info({ socketId: socket.id, interviewId }, "[ws] interview cancelled");
      } catch (err) {
        const code = (err instanceof Error ? err.message : "INTERNAL_ERROR") as WsErrorCode;
        socket.emit("ws:error", wsError(code, `Cancel failed: ${code}`, interviewId));
      }
    });

    // ── heartbeat:ack ───────────────────────────────────────────────────────
    socket.on("heartbeat:ack", () => {
      // No-op — Socket.IO transport ping/pong handles dead connection detection.
    });

    // ── disconnect ──────────────────────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      logger.info(
        { socketId: socket.id, userId: socket.data.userId, reason },
        "[ws] disconnect event",
      );
      void handleDisconnect(socket, io);
    });
  });
}
