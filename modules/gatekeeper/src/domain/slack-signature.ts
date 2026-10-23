// Slack signs each request to the app with the app's signing secret: "v0=" and the HMAC-SHA256 of
// "v0:<timestamp>:<body>". A request older than 5 minutes may be a replay (ADR 0048).
import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_AGE_SECONDS = 300;

/** undefined when Slack signed the body at a time near `now` (microseconds), else why not. */
export function slackSignatureProblem(
  secret: string,
  headers: { timestamp?: string; signature?: string },
  body: string,
  now: number,
): string | undefined {
  const { timestamp = "", signature = "" } = headers;
  if (!/^\d+$/.test(timestamp)) return "the request has no X-Slack-Request-Timestamp";
  if (Math.abs(now / 1_000_000 - Number(timestamp)) > MAX_AGE_SECONDS) return "the request is older than 5 minutes";
  const expected = Buffer.from(`v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${body}`).digest("hex")}`);
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected)
    ? undefined
    : "the Slack signature does not match";
}
