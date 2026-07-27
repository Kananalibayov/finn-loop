// AC-1, AC-2, AC-3 (issue #6): single-admin auth.
// Password is verified against a bcrypt hash from ADMIN_PASSWORD_HASH.
// Session is a signed JWT (jose HS256) stored in an http-only cookie, signed
// with ADMIN_SESSION_SECRET. Both env vars are read server-side only.

import { compareSync, hashSync } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
// NOTE (issue #46): lib/auth.ts must stay Edge-Runtime-safe because middleware
// imports verifySession from here. Do NOT statically import lib/db (it pulls
// in better-sqlite3, a native module the Edge Runtime can't load). The
// DB-stored admin hash is read by the route handlers (login, password-change)
// and passed in via verifyPasswordAgainstHash below.

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

/** AC-2: verify a plaintext password against the configured bcrypt hash.
 *  AC-6 (issue #46): the caller resolves the candidate hash(es) — DB override
 *  first, then env fallback — and passes them in. This keeps lib/auth.ts free
 *  of any lib/db import so it stays Edge-Runtime-safe (middleware imports
 *  verifySession from here). Returns true if the password matches any hash. */
export function verifyPasswordAgainstHash(
  password: string,
  candidateHashes: Array<string | null | undefined>,
): boolean {
  for (const hash of candidateHashes) {
    if (!hash) continue;
    try {
      if (compareSync(password, hash)) return true;
    } catch {
      // Malformed hash — skip this source, try the next, never throw.
    }
  }
  return false;
}

/** AC-6 (issue #46): hash a plaintext password for storage. The caller writes
 *  it to the DB (or env). Kept here so the bcrypt cost factor is centralized. */
export function hashPassword(plaintext: string): string {
  return hashSync(plaintext, 10);
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

/** AC-3 (issue #68): mint a CLIENT session JWT with role + clientId. */
export async function createClientSessionCookie(clientId: number): Promise<string> {
  const token = await new SignJWT({ role: "client", clientId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(sessionSecret());
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

/** AC-2 (issue #74): mint an OPERATOR session JWT with operatorId + role. */
export async function createOperatorSessionCookie(
  operatorId: number,
  operatorRole: string,
): Promise<string> {
  const token = await new SignJWT({ role: "operator", operatorId, operatorRole })
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

/** AC-3 (issue #68): verify a JWT and return the decoded payload (role + clientId).
 *  Returns null if invalid/expired. Used by middleware + portal routes. */
export async function verifySessionRole(
  token: string | undefined | null,
): Promise<{ role: string; clientId?: number; operatorId?: number; operatorRole?: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    const role = (payload as { role?: string }).role ?? "admin";
    const clientId = (payload as { clientId?: number }).clientId;
    const operatorId = (payload as { operatorId?: number }).operatorId;
    const operatorRole = (payload as { operatorRole?: string }).operatorRole;
    return { role, clientId, operatorId, operatorRole };
  } catch {
    return null;
  }
}
