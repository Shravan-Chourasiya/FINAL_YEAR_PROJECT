import type { Request } from "express";

export interface StandardRequest extends Request {
  _id: string;
  userId: string;
  userRole: string;
}

export interface AuthenticatedRequest extends StandardRequest {
  auth: {
    userId: string;
    sessionId: string;
    tokenFamily: string;
    accessToken: string;
    refreshToken: string;
  };
}
