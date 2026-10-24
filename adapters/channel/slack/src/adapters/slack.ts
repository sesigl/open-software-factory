// Slack through Vercel Chat SDK (ADR 0059): one Chat with the Slack adapter and memory state per command, so the
// program keeps nothing between runs. CHANNEL_API_URL names the Web API, CHANNEL_TOKEN is the bot token.
import { createSlackAdapter, type SlackAdapter } from "@chat-adapter/slack";
import { createMemoryState } from "@chat-adapter/state-memory";
import { check } from "@opensoftware/cli";
import { Chat, type Logger } from "chat";
import { signed } from "../domain/messages.ts";

export interface Slack {
  chat: Chat<{ slack: SlackAdapter }>;
  slack: SlackAdapter;
}

/** The SDK logs to the console; the program's output is its JSON lines only. */
const QUIET: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => QUIET,
};

export function connect(env: NodeJS.ProcessEnv = process.env): Slack {
  const token = env.CHANNEL_TOKEN;
  check(token, "set CHANNEL_TOKEN to the Slack bot token");
  const secret = env.CHANNEL_SIGNING_SECRET ?? "";
  const now = env.OSF_NOW ? new Date(env.OSF_NOW) : new Date();
  const slack = createSlackAdapter({
    apiUrl: env.CHANNEL_API_URL || "https://slack.com/api/",
    botToken: token,
    // The SDK checks the time against the clock; the adapter checks it against OSF_NOW, which tests fix.
    webhookVerifier: (request, body) => signed(request.headers, body, secret, now),
    logger: QUIET,
  });
  const chat = new Chat({ userName: "factory", adapters: { slack }, state: createMemoryState(), logger: QUIET });
  return { chat, slack };
}

/** Runs a call to Slack and names a token that Slack refuses. */
export async function calling<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    const code = (error as { data?: { error?: string } }).data?.error;
    if (code === "invalid_auth" || code === "not_authed") throw new Error("the channel refused the token");
    throw error;
  }
}
