// An in-process fake of the Slack Web API subset modules use (ADR 0016). Every call needs the bot token; the test
// reads what the module posted and posts as a person. It delivers events and button presses to the module's
// request URLs, signed like Slack with its signing secret (ADR 0048).
import { createHmac } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { FIXED_DATE } from "../support/process.ts";

/** A button of a message's `actions` block. */
export interface SlackButton {
  actionId: string;
  text: string;
  value?: string;
}

export interface SlackMessage {
  channel: string;
  ts: string;
  /** The ts of the thread's first message; equal to `ts` for a message outside a thread. */
  threadTs: string;
  user: string;
  text: string;
  reactions: string[];
  /** The buttons of the message's `actions` blocks. */
  buttons: SlackButton[];
}

export interface FakeSlack {
  /** Base URL of the Web API, ending in `/api/`, for example `${url}chat.postMessage`. */
  url: string;
  /** The bot token the module must send as `Authorization: Bearer <token>`. */
  token: string;
  /** The bot's user ID, which `auth.test` answers and which every message the module posts carries. */
  bot: string;
  /** The app's signing secret: every request the fake sends to the module carries Slack's signature with it. */
  signingSecret: string;
  /** The headers Slack sends with this body: the request time and the signature with the signing secret. */
  sign(body: string): Record<string, string>;
  /** Every message in the channel, oldest first, thread replies included. */
  messages(channel: string): SlackMessage[];
  /** Posts a message as a person; with `deliverTo`, also sends it to the module as an Events API `message` event. */
  say(message: { channel: string; text: string; user?: string; threadTs?: string }): Promise<SlackMessage>;
  /**
   * The module's Events API request URL, where `say` posts events, and its interactivity request URL, where `press`
   * posts button presses.
   */
  deliverTo(url: string, interactivity?: string): void;
  /** A person presses the button `actionId` of the message `ts`; the module gets a `block_actions` payload. */
  press(press: { channel: string; ts: string; actionId: string; user?: string }): Promise<void>;
}

export interface RunningSlack {
  slack: FakeSlack;
  close(): Promise<string[]>;
}

const TOKEN = "xoxb-testkit";
const BOT = "U0BOT";
const SIGNING_SECRET = "testkit-signing-secret";
// Slack signs with the time of the request; the fake uses the fixed clock that the module gets as OSF_NOW.
const SIGNED_AT = String(Date.parse(FIXED_DATE) / 1000);
const METHODS = [
  "auth.test",
  "chat.getPermalink",
  "chat.postMessage",
  "conversations.history",
  "conversations.replies",
  "reactions.add",
  "users.info",
];
/** The people `users.info` knows: the bot and the default person (ADR 0059). */
const PEOPLE: Record<string, string> = { [BOT]: "factory", U0PERSON: "Varun" };
/** The workspace's address in the links of `chat.getPermalink`. */
const WORKSPACE = "https://testkit.slack.com";

export async function startSlack(): Promise<RunningSlack> {
  const messages: SlackMessage[] = [];
  const problems: string[] = [];
  let events: string | undefined;
  let interactivity: string | undefined;
  let clock = 0;
  // Fixed, increasing timestamps: 1767225600.000001, .000002, ...
  const nextTs = (): string => `1767225600.${String(++clock).padStart(6, "0")}`;

  const post = (
    message: Omit<SlackMessage, "ts" | "threadTs" | "reactions" | "buttons"> & {
      threadTs?: string;
      buttons?: SlackButton[];
    },
  ) => {
    const ts = nextTs();
    const stored = { ...message, ts, threadTs: message.threadTs ?? ts, reactions: [], buttons: message.buttons ?? [] };
    messages.push(stored);
    return stored;
  };

  const server = createServer(async (request, response) => {
    const method = (request.url ?? "").replace(/^\/api\//, "").split("?")[0] ?? "";
    const args = await readArgs(request);
    const reply = (body: Record<string, unknown>): void => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(body));
    };
    if (!METHODS.includes(method)) {
      problems.push(`fake Slack: the Web API method ${method} is not supported`);
      return reply({ ok: false, error: "unknown_method" });
    }
    if (request.headers.authorization !== `Bearer ${TOKEN}` && args.token !== TOKEN) {
      return reply({ ok: false, error: "invalid_auth" });
    }
    if (method === "auth.test") return reply({ ok: true, user_id: BOT, bot_id: "B0BOT", team_id: "T0TESTKIT" });
    if (method === "users.info") {
      const id = String(args.user ?? "");
      const name = PEOPLE[id];
      if (!name) return reply({ ok: false, error: "user_not_found" });
      const profile = { real_name: name, display_name: name };
      return reply({ ok: true, user: { id, name: name.toLowerCase(), real_name: name, is_bot: id === BOT, profile } });
    }
    const channel = String(args.channel ?? "");
    if (method === "chat.getPermalink") {
      const ts = String(args.message_ts ?? "");
      const found = messages.find((message) => message.channel === channel && message.ts === ts);
      if (!found) return reply({ ok: false, error: "message_not_found" });
      const link = `${WORKSPACE}/archives/${channel}/p${ts.replace(".", "")}`;
      const thread = found.threadTs === ts ? "" : `?thread_ts=${found.threadTs}&cid=${channel}`;
      return reply({ ok: true, channel, permalink: `${link}${thread}` });
    }
    if (method === "chat.postMessage") {
      const threadTs = args.thread_ts ? String(args.thread_ts) : undefined;
      const message = post({ channel, user: BOT, text: String(args.text ?? ""), threadTs, buttons: buttonsOf(args) });
      return reply({ ok: true, channel, ts: message.ts, message: { text: message.text, ts: message.ts } });
    }
    if (method === "reactions.add") {
      const target = messages.find((message) => message.channel === channel && message.ts === String(args.timestamp));
      if (!target) return reply({ ok: false, error: "message_not_found" });
      target.reactions.push(String(args.name));
      return reply({ ok: true });
    }
    const inChannel = messages.filter((message) => message.channel === channel);
    // Slack's history lists the messages that start a thread, newest first; replies list a thread oldest first.
    const list =
      method === "conversations.replies"
        ? inChannel.filter((message) => message.threadTs === String(args.ts))
        : inChannel.filter((message) => message.threadTs === message.ts).reverse();
    return reply({
      ok: true,
      messages: list.map(({ ts, threadTs, user, text }) => ({ type: "message", ts, thread_ts: threadTs, user, text })),
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  /** Posts a signed request to the module like Slack does, and records an answer other than 2xx. */
  const send = async (url: string, contentType: string, body: string): Promise<void> => {
    const delivered = await fetch(url, {
      method: "POST",
      headers: { "content-type": contentType, ...sign(body) },
      body,
    });
    if (!delivered.ok) problems.push(`fake Slack: ${url} answered with ${delivered.status}`);
  };

  return {
    slack: {
      url: `http://127.0.0.1:${port}/api/`,
      token: TOKEN,
      bot: BOT,
      signingSecret: SIGNING_SECRET,
      sign,
      messages: (channel) => messages.filter((message) => message.channel === channel),
      async say({ channel, text, user = "U0PERSON", threadTs }) {
        const message = post({ channel, text, user, threadTs });
        if (events) {
          const event = { type: "message", channel, user, text, ts: message.ts, thread_ts: message.threadTs };
          await send(
            events,
            "application/json",
            JSON.stringify({ type: "event_callback", event_id: `Ev${clock}`, event }),
          );
        }
        return message;
      },
      deliverTo(url, actions) {
        events = url;
        interactivity = actions;
      },
      async press({ channel, ts, actionId, user = "U0PERSON" }) {
        const message = messages.find((candidate) => candidate.channel === channel && candidate.ts === ts);
        const button = message?.buttons.find((candidate) => candidate.actionId === actionId);
        if (!message || !button || !interactivity) {
          const problem = button ? "call deliverTo(events, interactivity) before press" : "has no such button";
          throw new Error(
            `fake Slack: the message ${ts} in ${channel} ${button ? "can't be pressed: " : ""}${problem}: ${actionId}`,
          );
        }
        const payload = {
          type: "block_actions",
          user: { id: user },
          channel: { id: channel },
          container: { type: "message", message_ts: ts, channel_id: channel },
          message: { ts, thread_ts: message.threadTs, text: message.text },
          actions: [{ action_id: actionId, value: button.value, type: "button", action_ts: nextTs() }],
        };
        await send(
          interactivity,
          "application/x-www-form-urlencoded",
          new URLSearchParams({ payload: JSON.stringify(payload) }).toString(),
        );
      },
    },
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      return problems;
    },
  };
}

/** Slack accepts JSON bodies and form-encoded bodies. */
async function readArgs(request: IncomingMessage): Promise<Record<string, unknown>> {
  let body = "";
  request.setEncoding("utf8");
  for await (const chunk of request) body += chunk;
  if (!body) return {};
  if ((request.headers["content-type"] ?? "").includes("application/json")) {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(body));
}

function sign(body: string): Record<string, string> {
  const signature = `v0=${createHmac("sha256", SIGNING_SECRET).update(`v0:${SIGNED_AT}:${body}`).digest("hex")}`;
  return { "x-slack-request-timestamp": SIGNED_AT, "x-slack-signature": signature };
}

/** The buttons of the `actions` blocks of chat.postMessage; `blocks` is JSON text in a form body. */
function buttonsOf(args: Record<string, unknown>): SlackButton[] {
  // A form body carries the blocks as JSON text; a JSON body carries them as they are.
  const blocks: unknown = typeof args.blocks === "string" ? JSON.parse(args.blocks) : args.blocks;
  if (!Array.isArray(blocks)) return [];
  return blocks
    .filter((block) => block?.type === "actions" && Array.isArray(block.elements))
    .flatMap((block) => block.elements)
    .filter((element) => element?.type === "button")
    .map((element) => ({
      actionId: String(element.action_id),
      text: String(element.text?.text ?? ""),
      ...(element.value === undefined ? {} : { value: String(element.value) }),
    }));
}
