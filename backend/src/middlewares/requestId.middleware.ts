import { type RequestHandler } from "express";
import { randomUUID } from "crypto";
import type { StandardRequest } from "../types/request.js";



export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const sreq=req as StandardRequest;
  if (!sreq._id) {
    sreq._id = randomUUID();
  }
  res.locals.requestId = sreq._id;
  next();
};
