// A Slack channel through the Web API: the request is a message, decisions are replies in its thread.
import type { Channel, Message } from "../domain/gate.ts";
import { fromSlackTs } from "../domain/time.ts";

interface SlackMessage {
  ts: string;
  thread_ts?: string;
  user?: string;
  text?: string;
}

export function slackChannel(channel: string, api: { url: string; token: string }): Channel {
  // Form bodies: Slack's read methods take no JSON.
  const call = async <T>(method: string, args: Record<string, string>): Promise<T> => {
    const response = await fetch(`${api.url}${method}`, {
      method: "POST",
      headers: { authorization: `Bearer ${api.token}`, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(args),
    });
    const answer = (await response.json()) as { ok: boolean; error?: string } & T;
    if (!answer.ok) throw new Error(`Slack ${method} failed: ${answer.error ?? response.status}`);
    return answer;
  };
  let bot: Promise<string> | undefined;
  const me = (): Promise<string> => {
    bot ??= call<{ user_id: string }>("auth.test", {}).then((answer) => answer.user_id);
    return bot;
  };
  const message = (raw: SlackMessage, mine: string): Message => ({
    id: raw.ts,
    author: `slack:${raw.user ?? ""}`,
    time: fromSlackTs(raw.ts),
    text: raw.text ?? "",
    mine: raw.user === mine,
  });
  const render = (text: string, marker: string): string => `${text}\n[${marker}]`;

  return {
    name: `slack:${channel}`,
    mention: (identity) => (identity.startsWith("slack:") ? `<@${identity.slice(6)}>` : identity),
    howToDecide: 'Reply "approve" or "reject <reason>" in this thread.',
    async find(marker) {
      const mine = await me();
      const { messages } = await call<{ messages: SlackMessage[] }>("conversations.history", { channel, limit: "200" });
      const found = messages.find(
        (raw) => (raw.thread_ts ?? raw.ts) === raw.ts && raw.user === mine && (raw.text ?? "").includes(`[${marker}]`),
      );
      return found && message(found, mine);
    },
    async thread(request) {
      const mine = await me();
      const { messages } = await call<{ messages: SlackMessage[] }>("conversations.replies", {
        channel,
        ts: request.id,
        limit: "1000",
      });
      return messages.filter((raw) => raw.ts !== request.id).map((raw) => message(raw, mine));
    },
    async post(text, marker, request) {
      const args: Record<string, string> = { channel, text: render(text, marker) };
      if (request) args.thread_ts = request.id;
      const answer = await call<{ ts: string }>("chat.postMessage", args);
      return message({ ts: answer.ts, user: await me(), text: args.text }, await me());
    },
  };
}
