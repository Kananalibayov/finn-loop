// AC-1, AC-2, AC-3 (issue #6): single-admin auth.
// Password is verified against a bcrypt hash from ADMIN_PASSWORD_HASH.
// Session is a signed JWT (jose HS256) stored in an http-only cookie, signed
// with ADMIN_SESSION_SECRET. Both env vars are read server-side only.

import { compareSync } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

const SESSION_COOKIE = "admin_session";
// 7 days — a long-lived operator session; localhost/single-user only (NG-1).
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

/** Secret as bytes; throws clearly if unset. */
function sessionSecret(): Uint8Array {
  const raw = process.env.ADMIN_SESSION_SECRET;
  if (!raw) {
    throw new Error(
      "ADMIN_SESSION_SECRET is not set. Copy .env.example to .env and add a secret (>= 32 chars).",
    );
  }
  return new TextEncoder().encode(raw);
}

/** AC-2: verify a plaintext password against the configured bcrypt hash. */
export function verifyPassword(password: string): boolean {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    // No hash configured = nobody can log in. Fail closed.
    return false;
  }
  try {
    return compareSync(password, hash);
  } catch {
    // Malformed hash = treat as no-match, never throw.
    return false;
  }
}

/** AC-3: mint a signed JWT and return the Set-Cookie header value. */
export async function createSessionCookie(): Promise<string> {
  const token = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(sessionSecret());
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

/** Cookie name, exposed for the logout route. */
export const COOKIE_NAME = SESSION_COOKIE;

/** Verify a JWT from a cookie value. Returns true if valid + unexpired. */
export async function verifySession(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, sessionSecret());
    return true;
  } catch {
    return false;
  }
}
