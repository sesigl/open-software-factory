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

/** The decision of a person who pressed the button `choice` of the card `card`. */
export function decision(thread: string, card: string, choice: string, user: string): Record<string, unknown> {
  return { kind: "decision", thread, card, choice, person: `slack:${user}` };
}
