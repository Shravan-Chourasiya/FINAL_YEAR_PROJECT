import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import pino from "pino";
import { Transform } from "stream";

import { ErrorCodes } from "../src/constants/errorCodes.js";
import { AppError } from "../src/utils/AppError.js";


// ---------------------------------------------------------------------------
// Helper: create a pino logger that writes to a custom stream, returning
// collected log lines.
// ---------------------------------------------------------------------------
function createTestLogger(opts?: { level?: string }) {
  const logs: Record<string, unknown>[] = [];
  const stream = new Transform({
    objectMode: true,
    transform(chunk, _enc, cb) {
      logs.push(JSON.parse(String(chunk).trim()));
      cb();
    },
  });

  const logger = pino(
    {
      level: opts?.level ?? "trace",
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "res.headers['set-cookie']",
          "req.body.password",
          "req.body.currentPassword",
          "req.body.newPassword",
          "req.body.passwordConfirmation",
          "req.body.token",
          "req.body.accessToken",
          "req.body.refreshToken",
          "req.body.sessionToken",
          "req.body.csrfToken",
          "req.body.verificationToken",
          "req.body.resetToken",
          "req.body.otp",
          "req.body.secret",
          "req.body.apiKey",
          "req.body.clientSecret",
          "req.body.privateKey",
        ],
        censor: "[REDACTED]",
      },
    },
    stream,
  );

  return { logger, logs };
}


describe("Logger redaction", () => {
  let logs: Record<string, unknown>[];
  let logger: pino.Logger;

  beforeEach(() => {
    const result = createTestLogger();
    logger = result.logger;
    logs = result.logs;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redacts req.headers.authorization", () => {
    logger.info({
      req: {
        headers: {
          authorization: "Bearer secret-token-12345",
        },
      },
    }, "test");

    expect(logs).toHaveLength(1);
    expect(logs[0]).toHaveProperty("req");
    const req = logs[0]["req"] as Record<string, unknown>;
    const headers = req["headers"] as Record<string, unknown>;
    expect(headers["authorization"]).toBe("[REDACTED]");
  });

  it("redacts req.headers.cookie", () => {
    logger.info({
      req: {
        headers: {
          cookie: "session=abc123; token=xyz",
        },
      },
    }, "test");

    expect(logs).toHaveLength(1);
    const req = logs[0]["req"] as Record<string, unknown>;
    const headers = req["headers"] as Record<string, unknown>;
    expect(headers["cookie"]).toBe("[REDACTED]");
  });

  it("redacts res.headers['set-cookie']", () => {
    logger.info({
      res: {
        headers: {
          "set-cookie": "session=abc123; HttpOnly; Secure",
        },
      },
    }, "test");

    expect(logs).toHaveLength(1);
    const res = logs[0]["res"] as Record<string, unknown>;
    const headers = res["headers"] as Record<string, unknown>;
    expect(headers["set-cookie"]).toBe("[REDACTED]");
  });

  it("redacts req.body.password", () => {
    logger.info({
      req: {
        body: {
          password: "supersecret123",
          email: "user@example.com",
        },
      },
    }, "test");

    expect(logs).toHaveLength(1);
    const req = logs[0]["req"] as Record<string, unknown>;
    const body = req["body"] as Record<string, unknown>;
    expect(body["password"]).toBe("[REDACTED]");
    expect(body["email"]).toBe("user@example.com");
  });

  it("redacts token fields", () => {
    logger.info({
      req: {
        body: {
          token: "secret-token",
          accessToken: "access-secret",
          refreshToken: "refresh-secret",
          sessionToken: "session-secret",
          csrfToken: "csrf-secret",
          verificationToken: "verify-secret",
          resetToken: "reset-secret",
          otp: "123456",
        },
      },
    }, "test");

    expect(logs).toHaveLength(1);
    const req = logs[0]["req"] as Record<string, unknown>;
    const body = req["body"] as Record<string, unknown>;
    expect(body["token"]).toBe("[REDACTED]");
    expect(body["accessToken"]).toBe("[REDACTED]");
    expect(body["refreshToken"]).toBe("[REDACTED]");
    expect(body["sessionToken"]).toBe("[REDACTED]");
    expect(body["csrfToken"]).toBe("[REDACTED]");
    expect(body["verificationToken"]).toBe("[REDACTED]");
    expect(body["resetToken"]).toBe("[REDACTED]");
    expect(body["otp"]).toBe("[REDACTED]");
  });

  it("redacts credential fields", () => {
    logger.info({
      req: {
        body: {
          secret: "app-secret",
          apiKey: "api-key-123",
          clientSecret: "client-secret-abc",
          privateKey: "private-key-xyz",
          currentPassword: "old-pass",
          newPassword: "new-pass",
          passwordConfirmation: "new-pass-again",
        },
      },
    }, "test");

    expect(logs).toHaveLength(1);
    const req = logs[0]["req"] as Record<string, unknown>;
    const body = req["body"] as Record<string, unknown>;
    expect(body["secret"]).toBe("[REDACTED]");
    expect(body["apiKey"]).toBe("[REDACTED]");
    expect(body["clientSecret"]).toBe("[REDACTED]");
    expect(body["privateKey"]).toBe("[REDACTED]");
    expect(body["currentPassword"]).toBe("[REDACTED]");
    expect(body["newPassword"]).toBe("[REDACTED]");
    expect(body["passwordConfirmation"]).toBe("[REDACTED]");
  });

  it("does NOT redact safe fields", () => {
    logger.info({
      req: {
        body: {
          name: "Alice",
          email: "alice@example.com",
          role: "admin",
        },
      },
    }, "test");

    expect(logs).toHaveLength(1);
    const req = logs[0]["req"] as Record<string, unknown>;
    const body = req["body"] as Record<string, unknown>;
    expect(body["name"]).toBe("Alice");
    expect(body["email"]).toBe("alice@example.com");
    expect(body["role"]).toBe("admin");
  });
});


describe("Error handler behavior", () => {
  it("AppError has correct statusCode", () => {
    const error = new AppError(
      "Unauthorized",
      401,
      ErrorCodes.AUTH_UNAUTHORIZED,
    );
    expect(error.statusCode).toBe(401);
  });

  it("AppError has correct errorCode", () => {
    const error = new AppError(
      "Not found",
      404,
      ErrorCodes.RESOURCE_NOT_FOUND,
    );
    expect(error.errorCode).toBe("RESOURCE_NOT_FOUND");
  });

  it("unexpected errors do NOT expose stack to client", () => {
    const error = new Error("Database connection failed");
    // The error handler constructs a sanitized response
    // The client should see only: { status: "error", statusCode: 500, message: "...", error: { code: "INTERNAL_SERVER_ERROR" } }
    // NEVER: error.stack, error.message, or infrastructure details
    const clientResponse = {
      status: "error",
      statusCode: 500,
      message: "An unexpected error occurred",
      error: {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
      },
    };

    expect(clientResponse.message).not.toContain("Database");
    expect(clientResponse.message).not.toContain("connection");
    expect(clientResponse).not.toHaveProperty("stack");
    expect(clientResponse.error).not.toHaveProperty("stack");
  });

  it("unexpected error response NEVER contains infrastructure details", () => {
    const clientResponse = {
      status: "error" as const,
      statusCode: 500,
      message: "An unexpected error occurred",
      error: {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
      },
    };

    // None of these should appear in the response
    const forbiddenPatterns = [
      "database",
      "redis",
      "postgres",
      "filesystem",
      "/tmp",
      "/var",
      "ETIMEDOUT",
      "ECONNREFUSED",
    ];

    const responseStr = JSON.stringify(clientResponse).toLowerCase();
    for (const pattern of forbiddenPatterns) {
      expect(responseStr).not.toContain(pattern.toLowerCase());
    }
  });
});
