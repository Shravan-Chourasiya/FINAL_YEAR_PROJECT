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
import { fetchInterviewById } from "../modules/interview/services/interview.service.js";
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
    event:        "ws:error",
    code,
    message,
    timestamp:    new Date().toISOString(),
    ...(interviewId ? { interviewId } : {}),
  };
}

// ── Ownership + state guard ───────────────────────────────────────────────────

async function assertInterviewAccess(socket: IoSocket, interviewId: string): Promise<void> {
  const interview = await fetchInterviewById(interviewId);

  if (!interview)                                    throw new Error("INTERVIEW_NOT_FOUND");
  if (interview.userId !== socket.data.userId)       throw new Error("AUTH_FORBIDDEN");
  if (interview.interviewStatus !== "INPROGRESS")    throw new Error("INTERVIEW_INVALID_STATE");
}

// ── Disconnect handler ────────────────────────────────────────────────────────

async function handleDisconnect(socket: IoSocket): Promise<void> {
  const { interviewId, userId } = socket.data;
  if (!interviewId || !userId) return;

  const session = await getSocketSession(interviewId);
  if (!session || session.socketId !== socket.id) return;

  logger.info({ socketId: socket.id, interviewId, userId }, "[ws] socket disconnected — starting grace period");

  await setGracePeriod(interviewId);

  setTimeout(async () => {
    const stillInGrace = await isInGracePeriod(interviewId);
    if (!stillInGrace) return; // client reconnected and cleared the grace key

    logger.info({ interviewId }, "[ws] grace period expired — pausing interview");
    await deleteSocketSession(interviewId);

    try {
      const db = getPgDb();
      await db
        .update(interviewsTable)
        .set({ interviewStatus: "SCHEDULED", lastActivityAt: new Date() })
        .where(eq(interviewsTable.id, interviewId));

      // Notify any other sockets in the room (e.g. observer tabs) of the state change
      const stateChange: InterviewStateChangePayload = {
        eventVersion: EVENT_VERSION,
        event:        "interview:state_change",
        interviewId,
        status:       "SCHEDULED",
        timestamp:    new Date().toISOString(),
      };
      socket.to(INTERVIEW_ROOM(interviewId)).emit("interview:state_change", stateChange);
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
          socket.emit("ws:error", wsError("CONTEXT_MISSING", "Interview session context not found — was the interview started?", interviewId));
          return;
        }

        const existing    = await getSocketSession(interviewId);
        const isReconnect = !!(existing && existing.userId === socket.data.userId);

        if (isReconnect) {
          await clearGracePeriod(interviewId);
          logger.info({ socketId: socket.id, interviewId }, "[ws] socket reconnected");
        }

        await setSocketSession(interviewId, {
          socketId:    socket.id,
          userId:      socket.data.userId!,
          connectedAt: new Date().toISOString(),
        });

        socket.data.interviewId = interviewId;
        await socket.join(INTERVIEW_ROOM(interviewId));

        const joined: InterviewJoinedPayload = {
          eventVersion:    EVENT_VERSION,
          event:           "interview:joined",
          interviewId,
          reconnected:     isReconnect,
          timerStartedAt:  context.timerStartedAt,
          durationMinutes: context.config.durationMinutes,
        };
        socket.emit("interview:joined", joined);
        logger.info({ socketId: socket.id, interviewId, reconnected: isReconnect }, "[ws] joined interview room");
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

      const left: InterviewLeftPayload = { eventVersion: EVENT_VERSION, event: "interview:left", interviewId };
      socket.emit("interview:left", left);
      logger.info({ socketId: socket.id, interviewId }, "[ws] left interview room");
    });

    // ── answer:submit ───────────────────────────────────────────────────────
    // Validates ownership then delegates to the HTTP service layer.
    // The actual DB write + question state transition happens in submitAnswerService;
    // the AI evaluation pipeline picks it up from there and emits ai:status /
    // evaluation:feedback back over the socket when ready.
    socket.on("answer:submit", async (payload) => {
      const { interviewId, questionId, answerData, answerType } = payload;
      try {
        await assertInterviewAccess(socket, interviewId);
        // Delegate to service layer — imported lazily to avoid circular deps
        const { submitAnswerService } = await import("../modules/interview/services/interview.service.js");
        const fakeAuthReq = { auth: { userId: socket.data.userId! } } as Parameters<typeof submitAnswerService>[0];
        await submitAnswerService(fakeAuthReq, interviewId, { questionId, answerData, answerType });
        logger.info({ socketId: socket.id, interviewId, questionId }, "[ws] answer submitted");
      } catch (err) {
        const code = (err instanceof Error ? err.message : "INTERNAL_ERROR") as WsErrorCode;
        socket.emit("ws:error", wsError(code, `Answer submission failed: ${code}`, interviewId));
      }
    });

    // ── code:submit ─────────────────────────────────────────────────────────
    // Treated as a TEXT answer for now; the codebox integration (Step N) will
    // replace this with sandbox execution before persisting.
    socket.on("code:submit", async (payload) => {
      const { interviewId, questionId, language, code } = payload;
      try {
        await assertInterviewAccess(socket, interviewId);
        const { submitAnswerService } = await import("../modules/interview/services/interview.service.js");
        const fakeAuthReq = { auth: { userId: socket.data.userId! } } as Parameters<typeof submitAnswerService>[0];
        // Encode language + code together until the codebox integration exists
        await submitAnswerService(fakeAuthReq, interviewId, {
          questionId,
          answerData:  `[${language}]\n${code}`,
          answerType:  "TEXT",
        });
        logger.info({ socketId: socket.id, interviewId, questionId, language }, "[ws] code submitted");
      } catch (err) {
        const code = (err instanceof Error ? err.message : "INTERNAL_ERROR") as WsErrorCode;
        socket.emit("ws:error", wsError(code, `Code submission failed: ${code}`, interviewId));
      }
    });

    // ── question:next ───────────────────────────────────────────────────────
    // Client signals it is ready for the next question.
    // The AI engine (Step 10) will handle generation; for now we emit ai:status
    // "thinking" to acknowledge the request and leave generation as a TODO.
    socket.on("question:next", async (payload) => {
      const { interviewId } = payload;
      try {
        await assertInterviewAccess(socket, interviewId);
        // TODO(Step 10): trigger LangGraph to generate and deliver the next question.
        // For now, acknowledge with ai:status so the client knows the request landed.
        socket.emit("ai:status", {
          eventVersion: EVENT_VERSION,
          event:        "ai:status",
          interviewId,
          questionId:   "pending",
          stage:        "thinking",
          timestamp:    new Date().toISOString(),
        });
        logger.info({ socketId: socket.id, interviewId }, "[ws] question:next received — AI stub acknowledged");
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
        const { cancelInterviewService } = await import("../modules/interview/services/interview.service.js");
        const fakeAuthReq = { auth: { userId: socket.data.userId! } } as Parameters<typeof cancelInterviewService>[0];
        await cancelInterviewService(fakeAuthReq, interviewId);

        await deleteSocketSession(interviewId);

        const stateChange: InterviewStateChangePayload = {
          eventVersion: EVENT_VERSION,
          event:        "interview:state_change",
          interviewId,
          status:       "CANCELLED",
          timestamp:    new Date().toISOString(),
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
      // No-op — receipt of the ack is sufficient to confirm the client is alive.
      // Socket.IO's transport-level ping/pong handles dead connection detection;
      // this application-level ack is for explicit liveness confirmation.
    });

    // ── disconnect ──────────────────────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      logger.info({ socketId: socket.id, userId: socket.data.userId, reason }, "[ws] disconnect event");
      void handleDisconnect(socket);
    });
  });
}
