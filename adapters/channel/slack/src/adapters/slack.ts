// Slack through Vercel Chat SDK (ADR 0059): one Chat with the Slack adapter and memory state per command, so the
// program keeps nothing between runs. CHANNEL_API_URL names the Web API, CHANNEL_TOKEN is the bot token.
import { createSlackAdapter, type SlackAdapter } from "@chat-adapter/slack";
import { createMemoryState } from "@chat-adapter/state-memory";
import type { Channel } from "@opensoftware/channel-kit";
import { check } from "@opensoftware/cli";
import { Actions, Button, Card, CardText, Chat, ConsoleLogger, type Message } from "chat";
import { decision, followed, said, signed, slackTime, workItem } from "../domain/messages.ts";

/** The SDK logs to the console; the program's output is its JSON lines only. */
const QUIET = new ConsoleLogger("silent");

async function connect(follow: string[] = [], env: NodeJS.ProcessEnv = process.env) {
  const token = env.CHANNEL_TOKEN;
  check(token, "set CHANNEL_TOKEN to the Slack bot token");
  const secret = env.CHANNEL_SIGNING_SECRET ?? "";
  const now = env.OSF_NOW ? new Date(env.OSF_NOW) : new Date();
  const adapter = createSlackAdapter({
    apiUrl: env.CHANNEL_API_URL || "https://slack.com/api/",
    botToken: token,
    // The SDK checks the time against the clock; the adapter checks it against OSF_NOW, which tests fix.
    webhookVerifier: (request, body) => signed(request.headers, body, secret, now),
    logger: QUIET,
  });
  // The client keeps the threads it follows; the memory state holds them for this one run (ADR 0061).
  const state = createMemoryState();
  await state.connect();
  for (const thread of follow) await state.subscribe(thread);
  const chat = new Chat({ userName: "factory", adapters: { slack: adapter }, state, logger: QUIET });
  return { chat, adapter };
}

/** Runs a call to Slack and names a token that Slack refuses. */
async function calling<T>(call: () => Promise<T>): Promise<T> {
  return call().catch((error: { data?: { error?: string } }) => {
    throw error.data?.error === "invalid_auth" ? new Error("the channel refused the token") : error;
  });
}

/** The work item of a person's message that mentions the bot, with a link to the message. */
async function mentioned(adapter: SlackAdapter, thread: string, message: Message) {
  const { channel } = adapter.decodeThreadId(thread);
  const link = await calling(() => adapter.client.chat.getPermalink({ channel, message_ts: message.id }));
  return workItem({
    thread,
    message: message.id,
    text: (message.raw as { text: string }).text,
    bot: adapter.botUserId ?? "",
    user: message.author.userId,
    name: message.author.fullName,
    url: String(link.permalink),
  });
}

/** The time of a press: Slack's `action_ts` of the action. */
function pressedAt(raw: unknown, actionId: string): string {
  const actions = (raw as { actions?: { action_id?: string; action_ts?: string }[] }).actions ?? [];
  return slackTime(actions.find((action) => action.action_id === actionId)?.action_ts ?? "0");
}

/** A channel, as opposed to a thread: a post there starts a thread. */
const CHANNEL = /^slack:[A-Z0-9]+$/;

export const slack: Channel = {
  name: "channel-slack",
  thread: { form: "slack:<channel>:<ts>", pattern: /^slack:[^:]+:\d+\.\d+$/ },
  channel: { form: "slack:<channel>", pattern: CHANNEL },
  api: "CHANNEL_API_URL is Slack's Web API, by default https://slack.com/api/.",
  async receive(keep, follow) {
    const { chat, adapter } = await connect(follow);
    chat.onNewMention((thread, message) => keep(mentioned(adapter, thread.id, message)));
    // A person's message in a followed thread, then what it would print in any other thread.
    chat.onSubscribedMessage(async (thread, message) => {
      await keep(Promise.resolve(followed(thread.id, message.raw)));
      if (message.isMention) await keep(mentioned(adapter, thread.id, message));
    });
    // A press of a card's button: its action ID is the choice.
    chat.onAction((event) =>
      keep(
        Promise.resolve(
          decision(
            event.threadId,
            event.messageId,
            event.actionId,
            event.user.userId,
            pressedAt(event.raw, event.actionId),
          ),
        ),
      ),
    );
    return (request, options) => chat.webhooks.slack(request, options);
  },
  async post(target, post) {
    const { chat } = await connect();
    // The question is the card's text, so the message's text is the question as the client gave it.
    const message =
      "text" in post
        ? post.text
        : Card({
            children: [
              CardText(post.question),
              Actions(post.choices.map((name) => Button({ id: name, label: name, value: name }))),
            ],
          });
    const sent = await calling(async () => {
      await chat.initialize();
      return CHANNEL.test(target) ? chat.channel(target).post(message) : chat.thread(target).post(message);
    });
    return { id: sent.id, thread: sent.threadId, time: slackTime(sent.id) };
  },
  async history(target) {
    const { chat, adapter } = await connect();
    const { messages } = await calling(async () => {
      await chat.initialize();
      return CHANNEL.test(target)
        ? adapter.fetchChannelMessages(target, { limit: 200 })
        : adapter.fetchMessages(target, { direction: "forward", limit: 1000 });
    });
    return messages.map((message) => said(message.raw, adapter.botUserId ?? ""));
  },
};
