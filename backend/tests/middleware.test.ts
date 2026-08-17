import { describe, it, expect, beforeEach, afterEach, type AddressInfo } from "vitest";
import express, { type Express } from "express";
import { StatusCodes } from "http-status-codes";
import type { Server } from "http";

import { ErrorCodes } from "../src/constants/errorCodes.js";
import { AppError } from "../src/utils/AppError.js";
import { errorHandler } from "../src/shared/middleware/errorHandler.js";
import { requestLogger } from "../src/utils/logger.js";
import { requestIdMiddleware } from "../src/middlewares/requestId.middleware.js";


// ---------------------------------------------------------------------------
// Helper: build the app the same way server.ts does (minus listen), boot it on
// an ephemeral port, and drive it with Node's built-in fetch.
// ---------------------------------------------------------------------------
interface TestServer {
  app: Express;
  server: Server;
  baseUrl: string;
  close: () => Promise<void>;
}

async function startServer(configure: (app: Express) => void = () => {}): Promise<TestServer> {
  const app = express();
  app.use(express.json());
  app.use(requestIdMiddleware);
  app.use(requestLogger);

  configure(app);

  // 404 handler (same as server.ts)
  app.use((_req, res) => {
    res.status(StatusCodes.NOT_FOUND).json({
      status: "error",
      statusCode: StatusCodes.NOT_FOUND,
      message: "Route not found",
      error: { code: ErrorCodes.ROUTE_NOT_FOUND },
    });
  });

  // Central error handler — must be last
  app.use(errorHandler);

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    app,
    server,
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}


describe("Error middleware integration", () => {
  let ts: TestServer;

  beforeEach(async () => {
    ts = await startServer();
  });

  afterEach(async () => {
    await ts.close();
  });

  it("404 handler returns standard error envelope", async () => {
    const res = await fetch(`${ts.baseUrl}/nonexistent`);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(StatusCodes.NOT_FOUND);
    expect(body.status).toBe("error");
    expect(body.statusCode).toBe(404);
    expect(body.message).toBe("Route not found");
    expect((body.error as { code: string }).code).toBe(ErrorCodes.ROUTE_NOT_FOUND);
  });

  it("health endpoint still works", async () => {
    await ts.close();
    ts = await startServer((app) => {
      app.get("/health", (_req, res) => {
        res.status(StatusCodes.OK).json({ status: "ok", env: "test" });
      });
    });

    const res = await fetch(`${ts.baseUrl}/health`);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(StatusCodes.OK);
    expect(body.status).toBe("ok");
    expect(body.env).toBe("test");
  });

  it("AppError thrown from route returns standard error envelope", async () => {
    await ts.close();
    ts = await startServer((app) => {
      app.get("/throw", () => {
        throw new AppError(
          "Invalid credentials",
          StatusCodes.UNAUTHORIZED,
          ErrorCodes.AUTH_INVALID_CREDENTIALS,
        );
      });
    });

    const res = await fetch(`${ts.baseUrl}/throw`);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(StatusCodes.UNAUTHORIZED);
    expect(body.status).toBe("error");
    expect(body.statusCode).toBe(401);
    expect(body.message).toBe("Invalid credentials");
    expect((body.error as { code: string }).code).toBe(ErrorCodes.AUTH_INVALID_CREDENTIALS);
  });

  it("AppError with details includes them in response", async () => {
    await ts.close();
    ts = await startServer((app) => {
      app.get("/throw-details", () => {
        throw new AppError(
          "Validation failed",
          StatusCodes.BAD_REQUEST,
          ErrorCodes.VALIDATION_FAILED,
          {
            details: {
              fields: { email: "Invalid email address" },
            },
          },
        );
      });
    });

    const res = await fetch(`${ts.baseUrl}/throw-details`);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    expect(body.status).toBe("error");
    expect((body.error as { code: string }).code).toBe(ErrorCodes.VALIDATION_FAILED);
    expect((body.error as { details: unknown }).details).toEqual({
      fields: { email: "Invalid email address" },
    });
  });

  it("unexpected error returns sanitized 500 response", async () => {
    await ts.close();
    ts = await startServer((app) => {
      app.get("/throw-uncaught", () => {
        throw new Error("Database connection failed");
      });
    });

    const res = await fetch(`${ts.baseUrl}/throw-uncaught`);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(body.status).toBe("error");
    expect(body.statusCode).toBe(500);
    expect(body.message).toBe("An unexpected error occurred");
    expect((body.error as { code: string }).code).toBe(ErrorCodes.INTERNAL_SERVER_ERROR);
  });

  it("unexpected error NEVER exposes stack trace to client", async () => {
    await ts.close();
    ts = await startServer((app) => {
      app.get("/throw-stack", () => {
        throw new Error("Something broke");
      });
    });

    const res = await fetch(`${ts.baseUrl}/throw-stack`);
    const body = (await res.json()) as Record<string, unknown>;

    expect(body).not.toHaveProperty("stack");
    expect(body.error).not.toHaveProperty("stack");
    expect(JSON.stringify(body)).not.toContain("at ");
    expect(JSON.stringify(body)).not.toContain("throw-stack");
  });

  it("unexpected error NEVER exposes internal error message to client", async () => {
    await ts.close();
    ts = await startServer((app) => {
      app.get("/throw-internal", () => {
        throw new Error("PostgreSQL connection refused: ECONNREFUSED 127.0.0.1:5432");
      });
    });

    const res = await fetch(`${ts.baseUrl}/throw-internal`);
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.message).toBe("An unexpected error occurred");
    expect(body.message).not.toContain("PostgreSQL");
    expect(body.message).not.toContain("ECONNREFUSED");
    expect(body.message).not.toContain("5432");
  });

  it("unexpected error NEVER exposes database details to client", async () => {
    await ts.close();
    ts = await startServer((app) => {
      app.get("/throw-db", () => {
        throw new Error('SQL Error: relation "users" does not exist');
      });
    });

    const res = await fetch(`${ts.baseUrl}/throw-db`);
    const body = (await res.json()) as Record<string, unknown>;

    const bodyStr = JSON.stringify(body).toLowerCase();
    expect(bodyStr).not.toContain("sql");
    expect(bodyStr).not.toContain("relation");
    expect(bodyStr).not.toContain("users");
    expect(bodyStr).not.toContain("does not exist");
  });

  it("unexpected error NEVER exposes Redis details to client", async () => {
    await ts.close();
    ts = await startServer((app) => {
      app.get("/throw-redis", () => {
        throw new Error("Redis connection error: NOAUTH Authentication required");
      });
    });

    const res = await fetch(`${ts.baseUrl}/throw-redis`);
    const body = (await res.json()) as Record<string, unknown>;

    const bodyStr = JSON.stringify(body).toLowerCase();
    expect(bodyStr).not.toContain("redis");
    expect(bodyStr).not.toContain("noauth");
    expect(bodyStr).not.toContain("authentication");
  });

  it("unexpected error NEVER exposes filesystem paths to client", async () => {
    await ts.close();
    ts = await startServer((app) => {
      app.get("/throw-fs", () => {
        throw new Error("ENOENT: no such file or directory, open '/etc/passwd'");
      });
    });

    const res = await fetch(`${ts.baseUrl}/throw-fs`);
    const body = (await res.json()) as Record<string, unknown>;

    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain("/etc/passwd");
    expect(bodyStr).not.toContain("ENOENT");
  });
});
