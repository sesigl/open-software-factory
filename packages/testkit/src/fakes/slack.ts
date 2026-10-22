// An in-process fake of the Slack Web API subset modules use (ADR 0016). Every call needs the bot token; the test
// reads what the module posted and posts as a person.
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";

export interface SlackMessage {
  channel: string;
  ts: string;
  /** The ts of the thread's first message; equal to `ts` for a message outside a thread. */
  threadTs: string;
  user: string;
  text: string;
  reactions: string[];
}

export interface FakeSlack {
  /** Base URL of the Web API, ending in `/api/`, for example `${url}chat.postMessage`. */
  url: string;
  /** The bot token the module must send as `Authorization: Bearer <token>`. */
  token: string;
  /** The bot's user ID, which `auth.test` answers and which every message the module posts carries. */
  bot: string;
  /** Every message in the channel, oldest first, thread replies included. */
  messages(channel: string): SlackMessage[];
  /** Posts a message as a person; with `deliverTo`, also sends it to the module as an Events API `message` event. */
  say(message: { channel: string; text: string; user?: string; threadTs?: string }): Promise<SlackMessage>;
  /** The module's Events API request URL; `say` posts events there. */
  deliverTo(url: string): void;
}

export interface RunningSlack {
  slack: FakeSlack;
  close(): Promise<string[]>;
}

const TOKEN = "xoxb-testkit";
const BOT = "U0BOT";
const METHODS = ["auth.test", "chat.postMessage", "conversations.history", "conversations.replies", "reactions.add"];

export async function startSlack(): Promise<RunningSlack> {
  const messages: SlackMessage[] = [];
  const problems: string[] = [];
  let events: string | undefined;
  let clock = 0;
  // Fixed, increasing timestamps: 1767225600.000001, .000002, ...
  const nextTs = (): string => `1767225600.${String(++clock).padStart(6, "0")}`;

  const post = (message: Omit<SlackMessage, "ts" | "threadTs" | "reactions"> & { threadTs?: string }) => {
    const ts = nextTs();
    const stored = { ...message, ts, threadTs: message.threadTs ?? ts, reactions: [] };
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
    const channel = String(args.channel ?? "");
    if (method === "chat.postMessage") {
      const threadTs = args.thread_ts ? String(args.thread_ts) : undefined;
      const message = post({ channel, user: BOT, text: String(args.text ?? ""), threadTs });
      return reply({ ok: true, channel, ts: message.ts, message: { text: message.text, ts: message.ts } });
    }
    if (method === "reactions.add") {
      const target = messages.find((message) => message.channel === channel && message.ts === String(args.timestamp));
      if (!target) return reply({ ok: false, error: "message_not_found" });
      target.reactions.push(String(args.name));
      return reply({ ok: true });
    }
    const inChannel = messages.filter((message) => message.channel === channel);
    const list =
      method === "conversations.replies"
        ? inChannel.filter((message) => message.threadTs === String(args.ts))
        : inChannel;
    return reply({
      ok: true,
      messages: list.map(({ ts, threadTs, user, text }) => ({ type: "message", ts, thread_ts: threadTs, user, text })),
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    slack: {
      url: `http://127.0.0.1:${port}/api/`,
      token: TOKEN,
      bot: BOT,
      messages: (channel) => messages.filter((message) => message.channel === channel),
      async say({ channel, text, user = "U0PERSON", threadTs }) {
        const message = post({ channel, text, user, threadTs });
        if (events) {
          const event = { type: "message", channel, user, text, ts: message.ts, thread_ts: message.threadTs };
          const delivered = await fetch(events, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ type: "event_callback", event_id: `Ev${clock}`, event }),
          });
          if (!delivered.ok) problems.push(`fake Slack: ${events} answered the event with ${delivered.status}`);
        }
        return message;
      },
      deliverTo(url) {
        events = url;
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
