// receive, reply and ask: the channel port's commands on Slack (ADR 0059).
import { check, type Outcome, readInputs } from "@opensoftware/cli";
import { Actions, Button, Card, type Message, type PostableMessage } from "chat";
import { calling, connect, type Slack } from "../adapters/slack.ts";
import { type Delivery, decision, workItem } from "../domain/messages.ts";

const THREAD = /^slack:[^:]+:\d+\.\d+$/;

/** receive <delivery.json>: the work item or decision of one Events API or interactivity delivery, or nothing. */
export async function receive(file: string | undefined): Promise<Outcome> {
  check(file, "name the delivery file, like receive delivery.json");
  const [input] = readInputs([file], /./);
  const delivery = JSON.parse((input as { text: string }).text) as Delivery;
  check(
    typeof delivery.body === "string" && typeof delivery.headers === "object",
    `${file} holds {"headers": {...}, "body": "<the body as it arrived>"}`,
  );
  const { chat, slack } = connect();
  const lines: string[] = [];
  const failures: unknown[] = [];
  // The SDK logs a handler's error and goes on; the command fails with it instead.
  const keep = (work: Promise<Record<string, unknown>>) =>
    work.then((line) => void lines.push(JSON.stringify(line)), (error) => void failures.push(error));
  chat.onNewMention((thread, message) => keep(mentioned(slack, thread.id, message)));
  chat.onAction((event) =>
    keep(Promise.resolve(decision(event.threadId, event.messageId, event.actionId, event.user.userId))),
  );
  const tasks: Promise<unknown>[] = [];
  const request = new Request("http://channel.invalid/slack", {
    method: "POST",
    headers: delivery.headers,
    body: delivery.body,
  });
  const answer = await calling(() => chat.webhooks.slack(request, { waitUntil: (task) => tasks.push(task) }));
  if (answer.status === 401) throw new Error("the delivery's signature does not match CHANNEL_SIGNING_SECRET");
  await Promise.all(tasks);
  if (failures.length > 0) throw failures[0];
  return { lines };
}

/** reply <thread> <text>: posts the text in the thread. */
export async function reply(thread: string | undefined, text: string | undefined): Promise<Outcome> {
  check(thread !== undefined && THREAD.test(thread), "name the thread as slack:<channel>:<ts>");
  check(text, "give the text to post, like reply slack:C0WEB:1767225600.000001 'On it'");
  return post(thread as string, text);
}

/** ask <thread> <question> [--choice <name>]...: posts an approval card with one button per choice. */
export async function ask(
  thread: string | undefined,
  question: string | undefined,
  choices: string[],
): Promise<Outcome> {
  check(thread !== undefined && THREAD.test(thread), "name the thread as slack:<channel>:<ts>");
  check(question, "give the question, like ask slack:C0WEB:1767225600.000001 'Merge pull request 12?'");
  const names = choices.length > 0 ? choices : ["approve", "reject"];
  const buttons = names.map((name) => Button({ id: name, label: name, value: name }));
  return post(thread as string, Card({ title: question, children: [Actions(buttons)] }));
}

/** The work item of a person's message that mentions the bot, with a link to the message. */
async function mentioned(slack: Slack["slack"], thread: string, message: Message): Promise<Record<string, unknown>> {
  const { channel } = slack.decodeThreadId(thread);
  const link = await calling(() => slack.client.chat.getPermalink({ channel, message_ts: message.id }));
  return workItem({
    thread,
    message: message.id,
    text: (message.raw as { text: string }).text,
    bot: slack.botUserId ?? "",
    user: message.author.userId,
    name: message.author.fullName,
    url: String(link.permalink),
  });
}

async function post(thread: string, message: PostableMessage): Promise<Outcome> {
  const { chat } = connect();
  const sent = await calling(async () => {
    await chat.initialize();
    return chat.thread(thread).post(message);
  });
  return { lines: [JSON.stringify({ thread, id: sent.id })] };
}
