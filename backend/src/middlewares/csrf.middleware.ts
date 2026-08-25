import type { RequestHandler } from "express";
import { COOKIE_NAMES } from "../constants/auth.constants.js";

export const csrfTokenMiddleware: RequestHandler = (req, res, next) => {
  const csrfToken = req.cookies[COOKIE_NAMES.CSRF];
  const csrfHeader=req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];
   if (!csrfToken || !csrfHeader) {
     return res.status(403).json({ error: "Invalid or missing CSRF token" });
   }
  if (csrfToken !== csrfHeader) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }
 
  next();
};
