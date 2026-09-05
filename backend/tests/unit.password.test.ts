/**
 * unit.password.test.ts — Part 1.1
 * Password hashing/verification unit tests.
 * Uses real bcrypt (SALT_ROUNDS=1 for speed in tests, not the production 12).
 * No DB, no Redis.
 */
import { describe, it, expect } from "vitest";
import bcrypt from "bcrypt";

const TEST_ROUNDS = 1; // fast for tests; production uses 12

describe("Password hashing", () => {
  it("hashed password verifies correctly against the original", async () => {
    const hash = await bcrypt.hash("Password1", TEST_ROUNDS);
    const match = await bcrypt.compare("Password1", hash);
    expect(match).toBe(true);
  });

  it("wrong password fails verification", async () => {
    const hash = await bcrypt.hash("Password1", TEST_ROUNDS);
    const match = await bcrypt.compare("WrongPassword1", hash);
    expect(match).toBe(false);
  });

  it("hashing is non-deterministic — same input produces different hashes", async () => {
    const [h1, h2] = await Promise.all([
      bcrypt.hash("Password1", TEST_ROUNDS),
      bcrypt.hash("Password1", TEST_ROUNDS),
    ]);
    expect(h1).not.toBe(h2);
  });

  it("both non-deterministic hashes still verify correctly", async () => {
    const [h1, h2] = await Promise.all([
      bcrypt.hash("Password1", TEST_ROUNDS),
      bcrypt.hash("Password1", TEST_ROUNDS),
    ]);
    expect(await bcrypt.compare("Password1", h1)).toBe(true);
    expect(await bcrypt.compare("Password1", h2)).toBe(true);
  });

  it("hashing takes a non-trivial amount of time (not a fast unsalted hash)", async () => {
    // bcrypt with rounds=1 should still take >1ms; plain SHA-256 takes <0.1ms
    const start = Date.now();
    await bcrypt.hash("Password1", 10); // use 10 rounds for this timing check
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThan(10); // bcrypt at rounds=10 is always >10ms
  });

  it("hash output starts with bcrypt identifier $2b$", async () => {
    const hash = await bcrypt.hash("Password1", TEST_ROUNDS);
    expect(hash).toMatch(/^\$2b\$/);
  });

  it("empty string password hashes and verifies correctly", async () => {
    const hash = await bcrypt.hash("", TEST_ROUNDS);
    expect(await bcrypt.compare("", hash)).toBe(true);
    expect(await bcrypt.compare("notempty", hash)).toBe(false);
  });
});
