// The HMAC-SHA256 of a text in hex, as a module's webhook computes it to check the signature that a fake (Slack,
// Sentry) sends with a delivery. Web Crypto is a global of Node, so a test needs no import for it.

export async function hmacHex(secret: string, text: string): Promise<string> {
  const encode = (value: string): Uint8Array => new TextEncoder().encode(value);
  const key = await crypto.subtle.importKey("raw", encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, encode(text)));
  return [...mac].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
