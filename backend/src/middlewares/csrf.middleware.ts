import type { RequestHandler } from "express";
import { COOKIE_NAMES } from "../constants/auth.constants.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const csrfTokenMiddleware: RequestHandler = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const csrfToken = req.cookies[COOKIE_NAMES.CSRF];
  const csrfHeader = req.headers["x-csrf-token"] || req.headers["x-xsrf-token"];

  if (!csrfToken || !csrfHeader) {
    return res.status(403).json({ error: "Invalid or missing CSRF token" });
  }
  if (csrfToken !== csrfHeader) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  next();
};
