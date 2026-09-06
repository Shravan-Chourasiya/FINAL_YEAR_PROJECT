import { redisClient } from "../../../config/redis.init.js";
import type { InterviewContext } from "../types/interview.context.js";

const CONTEXT_KEY_PREFIX = "interview:context:";
const BUFFER_SECONDS = 10 * 60; // 10 min buffer beyond interview duration

function contextKey(interviewId: string): string {
  return `${CONTEXT_KEY_PREFIX}${interviewId}`;
}

export async function writeInterviewContext(
  context: InterviewContext,
  durationMinutes: number,
): Promise<void> {
  const ttlSeconds = durationMinutes * 60 + BUFFER_SECONDS;
  await redisClient.set(contextKey(context.interviewId), JSON.stringify(context), "EX", ttlSeconds);
}

export async function readInterviewContext(interviewId: string): Promise<InterviewContext | null> {
  const raw = await redisClient.get(contextKey(interviewId));
  if (!raw) return null;
  return JSON.parse(raw) as InterviewContext;
}

export async function deleteInterviewContext(interviewId: string): Promise<void> {
  await redisClient.del(contextKey(interviewId));
}
