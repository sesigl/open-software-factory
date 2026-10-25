// What a Slack delivery means for the factory, without I/O (ADR 0059): Slack's signature, a person's mention of the
// bot as a work item, and a press of an approval card's button as a decision.
import { createHmac, timingSafeEqual } from "node:crypto";

/** Slack refuses requests signed more than five minutes before or after now; so does the adapter. */
const TOLERANCE_SECONDS = 5 * 60;

/** Whether Slack signed the body with the secret (`v0`, HMAC-SHA256) within five minutes of `now`. */
export function signed(headers: Headers, body: string, secret: string, now: Date): boolean {
  const at = headers.get("x-slack-request-timestamp") ?? "";
  if (Math.abs(now.getTime() / 1000 - Number(at)) > TOLERANCE_SECONDS) return false;
  const expected = Buffer.from(`v0=${createHmac("sha256", secret).update(`v0:${at}:${body}`).digest("hex")}`);
  const given = Buffer.from(headers.get("x-slack-signature") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export interface Mention {
  thread: string;
  /** The message's ts. */
  message: string;
  /** The message's text as Slack sent it, with the bot's mention as `<@bot>`. */
  text: string;
  bot: string;
  user: string;
  name: string;
  url: string;
}

/** The work item of a person's message that mentions the bot (contracts/work-item). */
export function workItem(mention: Mention): Record<string, unknown> {
  const text = mention.text.replaceAll(`<@${mention.bot}>`, "").trim();
  return {
    kind: "work",
    workItem: {
      id: `${mention.thread}/${mention.message}`,
      type: "task",
      title: (text.split("\n")[0] ?? "").trim().slice(0, 300),
      description: text,
      requester: { kind: "person", id: `slack:${mention.user}`, displayName: mention.name },
      origin: { source: "slack", url: mention.url, externalId: mention.thread },
      dedupeKey: mention.thread,
    },
  };
}

/** The decision of a person who pressed the button `choice` of the card `card` at `time`. */
export function decision(
  thread: string,
  card: string,
  choice: string,
  user: string,
  time: string,
): Record<string, unknown> {
  return { kind: "decision", thread, card, choice, person: `slack:${user}`, time };
}

/** A Slack message as the Web API gives it. */
export interface Raw {
  ts?: string;
  user?: string;
  text?: string;
}

/** Slack's `ts`, seconds and microseconds, as RFC 3339 in UTC with all six digits. */
export function slackTime(ts: string): string {
  const [seconds = "0", fraction = ""] = ts.split(".");
  const whole = new Date(Number(seconds) * 1000).toISOString().slice(0, 19);
  return `${whole}.${fraction.padEnd(6, "0").slice(0, 6)}Z`;
}

/** A message of history: the text as Slack keeps it, and whether the bot wrote it. */
export function said(
  raw: unknown,
  bot: string,
): { id: string; person: string; time: string; text: string; mine: boolean } {
  const { ts = "", user = "", text = "" } = raw as Raw;
  return { id: ts, person: `slack:${user}`, time: slackTime(ts), text, mine: user === bot };
}

/** A person's message in a thread that the client follows. */
export function followed(thread: string, raw: unknown): Record<string, unknown> {
  const { mine: _, ...message } = said(raw, "");
  return { kind: "message", thread, ...message };
}
