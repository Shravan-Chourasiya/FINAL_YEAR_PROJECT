import { describe, it, expect, beforeEach, afterEach, type AddressInfo } from "vitest";
import express, { type Express } from "express";
import * as z from "zod";
import { StatusCodes } from "http-status-codes";
import type { Server } from "http";
import { validateBody } from "../src/middlewares/zodValidator.middleware.js";
import { errorHandler } from "../src/middlewares/errorHandler.middleware.js";
import { ErrorCodes } from "../src/constants/errorCodes.js";

interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

function startServer(schema: z.ZodTypeAny): Promise<TestServer> {
  return new Promise((resolve) => {
    const app: Express = express();
    app.use(express.json());

    app.post("/test", validateBody(schema), (req, res) => {
      res.status(StatusCodes.OK).json({ received: req.body });
    });

    app.use(errorHandler);

    const server: Server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise<void>((res, rej) => server.close((e) => (e ? rej(e) : res()))),
      });
    });
  });
}

const testSchema = z.object({
  email: z.string().email(),
  age: z.coerce.number().int().min(18),
});

describe("validateBody middleware", () => {
  let ts: TestServer;

  beforeEach(async () => {
    ts = await startServer(testSchema);
  });

  afterEach(async () => {
    await ts.close();
  });

  it("passes valid body to controller", async () => {
    const res = await fetch(`${ts.baseUrl}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", age: 25 }),
    });
    const body = await res.json() as { received: { email: string; age: number } };

    expect(res.status).toBe(StatusCodes.OK);
    expect(body.received.email).toBe("user@example.com");
    expect(body.received.age).toBe(25);
  });

  it("returns 422 for invalid body", async () => {
    const res = await fetch(`${ts.baseUrl}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email", age: 25 }),
    });

    expect(res.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
  });

  it("returns VALIDATION_FAILED error code", async () => {
    const res = await fetch(`${ts.baseUrl}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bad", age: 25 }),
    });
    const body = await res.json() as { error: { code: string } };

    expect(body.error.code).toBe(ErrorCodes.VALIDATION_FAILED);
  });

  it("error details include source: zod", async () => {
    const res = await fetch(`${ts.baseUrl}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bad" }),
    });
    const body = await res.json() as { error: { details: { source: string } } };

    expect(body.error.details.source).toBe("zod");
  });

  it("error details include per-field errors", async () => {
    const res = await fetch(`${ts.baseUrl}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bad", age: 10 }),
    });
    const body = await res.json() as { error: { details: { fields: { field: string; message: string }[] } } };

    expect(body.error.details.fields.length).toBeGreaterThan(0);
    expect(body.error.details.fields.some((f) => f.field === "email")).toBe(true);
    expect(body.error.details.fields.some((f) => f.field === "age")).toBe(true);
  });

  it("replaces req.body with parsed/coerced data", async () => {
    const res = await fetch(`${ts.baseUrl}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", age: "25" }), // age as string
    });
    const body = await res.json() as { received: { age: number } };

    expect(res.status).toBe(StatusCodes.OK);
    expect(typeof body.received.age).toBe("number"); // coerced from string
  });

  it("returns 422 for empty body", async () => {
    const res = await fetch(`${ts.baseUrl}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
  });

  it("error message explicitly mentions zod schema validation", async () => {
    const res = await fetch(`${ts.baseUrl}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bad" }),
    });
    const body = await res.json() as { message: string };

    expect(body.message.toLowerCase()).toContain("zod");
  });
});
