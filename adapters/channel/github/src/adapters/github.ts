// GitHub through Vercel Chat SDK (ADR 0059): one Chat with the GitHub adapter and memory state per command, so the
// program keeps nothing between runs. CHANNEL_API_URL names the REST API, CHANNEL_TOKEN is the bot's token, and the
// bot is the token's user.
import { createGitHubAdapter, type GitHubAdapter } from "@chat-adapter/github";
import { createMemoryState } from "@chat-adapter/state-memory";
import type { Channel } from "@opensoftware/channel-kit";
import { check } from "@opensoftware/cli";
import { Actions, Button, Card, CardText, Chat, ConsoleLogger, type Message } from "chat";
import { answerLine, cardFor, choiceOf, workItem } from "../domain/messages.ts";

/** The SDK logs to the console; the program's output is its JSON lines only. */
const QUIET = new ConsoleLogger("silent");

async function connect(env: NodeJS.ProcessEnv = process.env) {
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
  const chat = new Chat({
    userName: bot.login,
    adapters: { github: adapter },
    state: createMemoryState(),
    logger: QUIET,
  });
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
  return card && { kind: "decision", thread, card: card.id, choice, person: `github:${message.author.userName}` };
}

export const github: Channel = {
  name: "channel-github",
  thread: { form: "github:<owner>/<repo>:<number>", pattern: /^github:[^/:]+\/[^/:]+:\d+$/ },
  api: "CHANNEL_API_URL is GitHub's REST API, by default https://api.github.com.",
  async receive(keep) {
    const { chat, adapter, bot } = await connect();
    chat.onNewMention((thread, message) => keep(Promise.resolve(mentioned(bot, thread.id, message))));
    chat.onNewMessage(/^\s*\/[\w-]+\s*$/, (thread, message) => keep(answered(adapter, thread.id, message)));
    return (request, options) => chat.webhooks.github(request, options);
  },
  async post(thread, post) {
    const { chat } = await connect();
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
    return (await chat.thread(thread).post(message)).id;
  },
};
