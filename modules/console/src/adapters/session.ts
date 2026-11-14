// The session and the sign-in in progress as encrypted cookies (ADR 0134): JWE with a key from CONSOLE_SESSION_SECRET.
// The first key encrypts, every key decrypts, so a key changes without signing everyone out. No role in the cookie:
// the role comes from the access file at each request.
import { createHash } from "node:crypto";
import { EncryptJWT, jwtDecrypt } from "jose";

export interface Person {
  email: string;
  name?: string;
}

const keyOf = (secret: string): Uint8Array => new Uint8Array(createHash("sha256").update(secret).digest());

/** Encrypts the claims until `seconds` after `now` (ms). */
export async function seal(claims: Record<string, unknown>, keys: string[], now: number, seconds: number) {
  const issued = Math.floor(now / 1000);
  return new EncryptJWT(claims)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt(issued)
    .setExpirationTime(issued + seconds)
    .encrypt(keyOf(keys[0] ?? ""));
}

/** The claims of a cookie that one of the keys decrypts and that has not ended at `now`, else undefined. */
export async function unseal(token: string | undefined, keys: string[], now: number) {
  if (!token) return undefined;
  for (const key of keys) {
    try {
      const { payload } = await jwtDecrypt(token, keyOf(key), { currentDate: new Date(now) });
      return payload as Record<string, unknown>;
    } catch {}
  }
  return undefined;
}

/** The value of the cookie in a Cookie header. */
export const cookieOf = (header: string | undefined, name: string): string | undefined =>
  (header ?? "")
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([key]) => key === name)?.[1];

/** A Set-Cookie header for the console's own address: HttpOnly, SameSite=Lax, Secure over HTTPS. */
export const setCookie = (name: string, value: string, url: string, seconds: number): string =>
  [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${seconds}`,
    ...(url.startsWith("https://") ? ["Secure"] : []),
  ].join("; ");
