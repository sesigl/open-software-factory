// GitHub through Vercel Chat SDK (ADR 0059): one Chat with the GitHub adapter and memory state per command, so the
// program keeps nothing between runs. CHANNEL_API_URL names the REST API, CHANNEL_TOKEN is the bot's token, and the
// bot is the token's user.
import { createGitHubAdapter, type GitHubAdapter } from "@chat-adapter/github";
import { createMemoryState } from "@chat-adapter/state-memory";
import type { Channel } from "@opensoftware/channel-kit";
import { check } from "@opensoftware/cli";
import { Actions, Button, Card, CardText, Chat, ConsoleLogger, type Message } from "chat";
import { answerLine, cardFor, choiceOf, said, workItem } from "../domain/messages.ts";

/** The SDK logs to the console; the program's output is its JSON lines only. */
const QUIET = new ConsoleLogger("silent");

async function connect(follow: string[] = [], env: NodeJS.ProcessEnv = process.env) {
  const token = env.CHANNEL_TOKEN;
  check(token, "set CHANNEL_TOKEN to a GitHub token of the bot");
  const apiUrl = (env.CHANNEL_API_URL || "https://api.github.com").replace(/\/+$/, "");
  const answer = await fetch(`${apiUrl}/user`, {
    headers: { authorization: `Bearer ${token}`, "x-github-api-version": "2022-11-28" },
  });
  if (answer.status === 401) throw new Error("the channel refused the token");
  const bot = (await answer.json()) as { login: string; id: number };
  const adapter = createGitHubAdapter({
    apiUrl,
    token,
    // Without a secret the SDK refuses every delivery, which receive reports.
    webhookSecret: env.CHANNEL_SIGNING_SECRET ?? "",
    userName: bot.login,
    botUserId: bot.id,
    logger: QUIET,
  });
  // The client keeps the threads it follows; the memory state holds them for this one run (ADR 0061).
  const state = createMemoryState();
  await state.connect();
  for (const thread of follow) await state.subscribe(thread);
  const chat = new Chat({ userName: bot.login, adapters: { github: adapter }, state, logger: QUIET });
  return { chat, adapter, bot: bot.login };
}

/** The work item of a person's comment that mentions the bot, with a link to the comment. */
function mentioned(bot: string, thread: string, message: Message) {
  const { comment } = message.raw as { comment: { body: string; html_url: string; user: { login: string } } };
  return workItem({
    thread,
    message: message.id,
    text: comment.body,
    bot,
    login: comment.user.login,
    url: comment.html_url,
  });
}

/** The decision of an answer such as `/approve` to the newest card of the bot that offers that choice. */
async function answered(adapter: GitHubAdapter, thread: string, message: Message) {
  const choice = choiceOf(message.text) as string;
  const { messages } = await adapter.fetchMessages(thread, { limit: 100 });
  const comments = messages.map((each) => ({ id: each.id, mine: each.author.isMe === true, text: each.text }));
  const card = cardFor(comments, choice);
  const { time } = said(message.raw, "");
  return card && { kind: "decision", thread, card: card.id, choice, person: `github:${message.author.userName}`, time };
}

/** A person's comment in a followed thread, then what it would print in any other thread. */
async function followed(adapter: GitHubAdapter, bot: string, thread: string, message: Message) {
  const { mine: _, ...comment } = said(message.raw, bot);
  const line = { kind: "message", thread, ...comment };
  if (message.isMention) return [line, mentioned(bot, thread, message)];
  return choiceOf(message.text) ? [line, await answered(adapter, thread, message)] : [line];
}

export const github: Channel = {
  name: "channel-github",
  thread: { form: "github:<owner>/<repo>:<number>", pattern: /^github:[^/:]+\/[^/:]+:\d+$/ },
  api: "CHANNEL_API_URL is GitHub's REST API, by default https://api.github.com.",
  async receive(keep, follow) {
    const { chat, adapter, bot } = await connect(follow);
    chat.onNewMention((thread, message) => keep(Promise.resolve(mentioned(bot, thread.id, message))));
    chat.onNewMessage(/^\s*\/[\w-]+\s*$/, (thread, message) => keep(answered(adapter, thread.id, message)));
    chat.onSubscribedMessage(async (thread, message) => {
      for (const line of await followed(adapter, bot, thread.id, message)) await keep(Promise.resolve(line));
    });
    return (request, options) => chat.webhooks.github(request, options);
  },
  async post(thread, post) {
    const { chat, adapter, bot } = await connect();
    // GitHub has no buttons: the card names its choices and how to answer.
    const message =
      "text" in post
        ? post.text
        : Card({
            title: post.question,
            children: [
              CardText(answerLine(post.choices)),
              Actions(post.choices.map((name) => Button({ id: name, label: name }))),
            ],
          });
    await chat.initialize();
    // The adapter's own post gives GitHub's comment, with its time.
    const sent = await adapter.postMessage(thread, message);
    return { id: sent.id, time: said(sent.raw, bot).time };
  },
  async history(thread) {
    const { adapter, bot } = await connect();
    const { messages } = await adapter.fetchMessages(thread, { direction: "forward", limit: 100 });
    return messages.map((message) => ({ ...said(message.raw, bot), thread }));
  },
};
