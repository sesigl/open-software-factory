// Slack through Vercel Chat SDK (ADR 0059): one Chat with the Slack adapter and memory state per command, so the
// program keeps nothing between runs. CHANNEL_API_URL names the Web API, CHANNEL_TOKEN is the bot token.
import { createSlackAdapter, type SlackAdapter } from "@chat-adapter/slack";
import { createMemoryState } from "@chat-adapter/state-memory";
import type { Channel, Post } from "@opensoftware/channel-kit";
import { check } from "@opensoftware/cli";
import { Actions, Button, Card, CardText, Chat, ConsoleLogger, type Message } from "chat";
import { decision, line, signed, workItem } from "../domain/messages.ts";

/** The SDK logs to the console; the program's output is its JSON lines only. */
const QUIET = new ConsoleLogger("silent");

function connect(env: NodeJS.ProcessEnv = process.env) {
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
  const chat = new Chat({
    userName: "factory",
    adapters: { slack: adapter },
    state: createMemoryState(),
    logger: QUIET,
  });
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

/**
 * The SDK's form of a post: the text, or a card with one button per choice. The question is the card's text, not its
 * title: Slack cuts a title after 150 characters, and a question may hold links and lines (ADR 0062).
 */
function postable(post: Post) {
  return "text" in post
    ? post.text
    : Card({
        children: [
          CardText(post.question),
          Actions(post.choices.map((name) => Button({ id: name, label: name, value: name }))),
        ],
      });
}

/** The most messages that messages reads of a thread, and of the top of a channel. */
const THREAD_LIMIT = 1000;
const CHANNEL_LIMIT = 200;

/** A message as messages prints it, with the time from its ts. */
const printed = (message: Message) =>
  line({
    id: message.id,
    thread: message.threadId,
    user: message.author.userId,
    ts: (message.raw as { ts: string }).ts,
    text: (message.raw as { text?: string }).text ?? "",
    mine: message.author.isMe,
  });

export const slack: Channel = {
  name: "channel-slack",
  thread: { form: "slack:<channel>:<ts>", pattern: /^slack:[^:]+:\d+\.\d+$/ },
  channel: { form: "slack:<channel>", pattern: /^slack:[^:]+$/ },
  api: "CHANNEL_API_URL is Slack's Web API, by default https://slack.com/api/.",
  async receive(keep) {
    const { chat, adapter } = connect();
    chat.onNewMention((thread, message) => keep(mentioned(adapter, thread.id, message)));
    // A press of a card's button: its action ID is the choice.
    chat.onAction((event) =>
      keep(Promise.resolve(decision(event.threadId, event.messageId, event.actionId, event.user.userId))),
    );
    return (request, options) => chat.webhooks.slack(request, options);
  },
  async post(thread, post) {
    const { chat } = connect();
    const sent = await calling(async () => {
      await chat.initialize();
      return chat.thread(thread).post(postable(post));
    });
    return sent.id;
  },
  async start(channel, post) {
    const { chat } = connect();
    const sent = await calling(async () => {
      await chat.initialize();
      return chat.channel(channel).post(postable(post));
    });
    return { thread: sent.threadId, id: sent.id };
  },
  async messages(target) {
    const { chat, adapter } = connect();
    await calling(() => chat.initialize());
    if (slack.channel?.pattern.test(target)) {
      const page = await calling(() => adapter.fetchChannelMessages(target, { limit: CHANNEL_LIMIT }));
      return page.messages.map(printed);
    }
    const all: Message[] = [];
    let cursor: string | undefined;
    do {
      const page = await calling(() => adapter.fetchMessages(target, { direction: "forward", limit: 200, cursor }));
      all.push(...page.messages);
      cursor = page.nextCursor;
    } while (cursor && all.length < THREAD_LIMIT);
    return all.map(printed);
  },
};
