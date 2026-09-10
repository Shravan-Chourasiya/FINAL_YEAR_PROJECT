import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import type { IoServer } from "./socket.types.js";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "./socket.types.js";
import { registerSocketAuth } from "./socket.auth.js";
import { registerInterviewGateway } from "./interview.gateway.js";
import { corsOptions } from "../constants/cors.js";
import { logger } from "../utils/logger.js";

// Singleton — set once attachSocketServer is called
let _io: IoServer | null = null;

export function attachSocketServer(httpServer: HttpServer): IoServer {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    cors: {
      origin: corsOptions.origin,
      credentials: corsOptions.credentials,
      methods: corsOptions.methods,
    },
    // Socket.IO built-in heartbeat — detects dead connections at the transport level
    pingInterval: 25_000, // server pings every 25 s
    pingTimeout: 20_000, // client must respond within 20 s or is considered dead
    // connectionStateRecovery is intentionally disabled: the application implements
    // its own 30-second grace period via Redis (socket.registry.ts). Enabling
    // Socket.IO's built-in recovery would auto-rejoin rooms before interview:join
    // fires, breaking the isReconnect detection and the grace-period clear logic.
  });

  registerSocketAuth(io);
  registerInterviewGateway(io);

  _io = io;
  logger.info("[ws] Socket.IO server attached");
  return io;
}

// Use this to emit from outside the gateway (e.g. maintenance jobs)
export function getIo(): IoServer {
  if (!_io) throw new Error("Socket.IO server not initialised — call attachSocketServer first");
  return _io;
}
