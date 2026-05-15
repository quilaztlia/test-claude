// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("server-only", () => ({}));

const mockCookieSet = vi.fn();
const mockCookieGet = vi.fn();
const mockCookieStore = { set: mockCookieSet, get: mockCookieGet };
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

import { createSession, getSession } from "@/lib/auth";

const TEST_SECRET = new TextEncoder().encode("development-secret-key");

async function makeToken(payload: object, expiresIn = "7d") {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(TEST_SECRET);
}

describe("createSession", () => {
  beforeEach(() => {
    mockCookieSet.mockClear();
    mockCookieGet.mockClear();
  });

  test("sets an httpOnly cookie named auth-token", async () => {
    await createSession("user-1", "test@example.com");

    expect(mockCookieSet).toHaveBeenCalledOnce();
    const [name, , options] = mockCookieSet.mock.calls[0];
    expect(name).toBe("auth-token");
    expect(options.httpOnly).toBe(true);
  });

  test("cookie value is a signed JWT string", async () => {
    await createSession("user-1", "test@example.com");

    const [, token] = mockCookieSet.mock.calls[0];
    const parts = token.split(".");
    expect(parts).toHaveLength(3); // header.payload.signature
  });

  test("JWT payload contains userId and email", async () => {
    await createSession("user-42", "alice@example.com");

    const [, token] = mockCookieSet.mock.calls[0];
    const payload = JSON.parse(atob(token.split(".")[1]));
    expect(payload.userId).toBe("user-42");
    expect(payload.email).toBe("alice@example.com");
  });

  test("cookie expires approximately 7 days from now", async () => {
    const before = Date.now();
    await createSession("user-1", "test@example.com");
    const after = Date.now();

    const [, , options] = mockCookieSet.mock.calls[0];
    const expiresMs = options.expires.getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    expect(expiresMs).toBeGreaterThanOrEqual(before + sevenDays - 1000);
    expect(expiresMs).toBeLessThanOrEqual(after + sevenDays + 1000);
  });

  test("cookie has sameSite lax and path /", async () => {
    await createSession("user-1", "test@example.com");

    const [, , options] = mockCookieSet.mock.calls[0];
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });
});

describe("getSession", () => {
  beforeEach(() => {
    mockCookieGet.mockClear();
  });

  test("returns null when no cookie is present", async () => {
    mockCookieGet.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
  });

  test("returns session payload for a valid token", async () => {
    const token = await makeToken({ userId: "user-7", email: "bob@example.com", expiresAt: new Date() });
    mockCookieGet.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session?.userId).toBe("user-7");
    expect(session?.email).toBe("bob@example.com");
  });

  test("returns null for a tampered token", async () => {
    mockCookieGet.mockReturnValue({ value: "bad.token.here" });
    expect(await getSession()).toBeNull();
  });

  test("returns null for an expired token", async () => {
    const token = await makeToken({ userId: "user-1", email: "test@example.com" }, "-1s");
    mockCookieGet.mockReturnValue({ value: token });
    expect(await getSession()).toBeNull();
  });
});
