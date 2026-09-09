import { redisClient } from "../config/redis.init.js";

const SESSION_PREFIX = "socket:session:"; // socket:session:{interviewId} → SocketSession JSON
const GRACE_PREFIX = "socket:grace:"; // socket:grace:{interviewId}   → "1", TTL = grace seconds

const GRACE_TTL_SECONDS = 30;

export interface SocketSession {
  socketId: string;
  userId: string;
  connectedAt: string; // ISO-8601
}

export async function setSocketSession(interviewId: string, session: SocketSession): Promise<void> {
  await redisClient.set(`${SESSION_PREFIX}${interviewId}`, JSON.stringify(session));
}

export async function getSocketSession(interviewId: string): Promise<SocketSession | null> {
  const raw = await redisClient.get(`${SESSION_PREFIX}${interviewId}`);
  if (!raw) return null;
  return JSON.parse(raw) as SocketSession;
}

export async function deleteSocketSession(interviewId: string): Promise<void> {
  await redisClient.del(`${SESSION_PREFIX}${interviewId}`);
}

// Grace period: set when a socket disconnects — gives the client time to reconnect
// before the server treats the disconnect as permanent
export async function setGracePeriod(interviewId: string): Promise<void> {
  await redisClient.set(`${GRACE_PREFIX}${interviewId}`, "1", "EX", GRACE_TTL_SECONDS);
}

export async function isInGracePeriod(interviewId: string): Promise<boolean> {
  return (await redisClient.exists(`${GRACE_PREFIX}${interviewId}`)) === 1;
}

export async function clearGracePeriod(interviewId: string): Promise<void> {
  await redisClient.del(`${GRACE_PREFIX}${interviewId}`);
}

export { GRACE_TTL_SECONDS };
