// The channel port's commands around a chat (ADR 0059, ADR 0061): receive hands a delivery to the chat's webhook and
// prints what its handlers keep; reply and ask post in a thread, or start one in a channel, and print the message's
// ID; messages prints the messages of a thread or a channel.
import { check, type Outcome, readInputs } from "@opensoftware/cli";

/** One webhook request as the receiver got it: its headers and its body's text. */
export interface Delivery {
  headers: Record<string, string>;
  body: string;
}

/** What a handler gives for a delivery: one JSON line, or nothing. */
export type Line = Record<string, unknown> | undefined;

/** Keeps the line a handler gives; a handler's error fails receive. */
export type Keep = (work: Promise<Line>) => Promise<void>;

/** A chat's webhook handler, such as Vercel Chat SDK's `chat.webhooks.<adapter>`. */
export type Webhook = (request: Request, options: { waitUntil(task: Promise<unknown>): void }) => Promise<Response>;

/** A reply, or an approval card with its choices. */
export type Post = { text: string } | { question: string; choices: string[] };

export interface Channel {
  /** The program's name, like `channel-slack`. Every error starts with it. */
  name: string;
  /** A thread's form for people, like `slack:<channel>:<ts>`, and the pattern that checks it. */
  thread: { form: string; pattern: RegExp };
  /** A channel's form and pattern, like `slack:<channel>`, when the chat has channels that hold threads. */
  channel?: { form: string; pattern: RegExp };
  /** One sentence about the chat's API, like "CHANNEL_API_URL is Slack's Web API, by default https://slack.com/api/." */
  api: string;
  /** Registers the handlers of one delivery, which give their lines to `keep`, and gives the chat's webhook. */
  receive(keep: Keep): Promise<Webhook>;
  /** Posts in the thread and gives the posted message's ID. */
  post(thread: string, post: Post): Promise<string>;
  /** Posts at the top of a channel and gives the new thread and the message's ID. Needed with `channel`. */
  start?(channel: string, post: Post): Promise<{ thread: string; id: string }>;
  /**
   * The messages of a thread, the first one included, or the newest at the top of a channel, oldest first, each as
   * `{"id", "thread", "author", "time", "text", "mine"}`.
   */
  messages(target: string): Promise<Record<string, unknown>[]>;
}

/** The choices of an approval card when ask names none. */
const CHOICES = ["approve", "reject"];

/** receive <delivery.json>: what the chat's handlers keep for the delivery. */
export async function receive(channel: Channel, file: string | undefined): Promise<Outcome> {
  check(file, "name the delivery file, like receive delivery.json");
  const { headers, body }: Partial<Delivery> = JSON.parse(readInputs([file], /./)[0]?.text ?? "{}");
  check(headers instanceof Object && typeof body === "string", `${file} holds {"headers": {...}, "body": "..."}`);
  const lines: string[] = [];
  const failures: unknown[] = [];
  // A chat SDK logs a handler's error and goes on; receive fails with it instead.
  const keep: Keep = (work) =>
    work.then(
      (line) => void (line && lines.push(JSON.stringify(line))),
      (error) => void failures.push(error),
    );
  const webhook = await channel.receive(keep);
  const tasks: Promise<unknown>[] = [];
  const request = new Request("http://channel.invalid/", { method: "POST", headers, body });
  const answer = await webhook(request, { waitUntil: (task) => void tasks.push(task) });
  if (answer.status === 401) throw new Error("the delivery's signature does not match CHANNEL_SIGNING_SECRET");
  await Promise.all(tasks);
  if (failures.length > 0) throw failures[0];
  return { lines };
}

/** The thread or, when the chat has channels, the channel named on the command line; else a usage error. */
function target(channel: Channel, named: string | undefined): { name: string; isChannel: boolean } {
  const isChannel = named !== undefined && channel.channel?.pattern.test(named) === true;
  const forms = channel.channel
    ? `${channel.thread.form} or a channel as ${channel.channel.form}`
    : channel.thread.form;
  check(isChannel || (named !== undefined && channel.thread.pattern.test(named)), `name the thread as ${forms}`);
  return { name: named as string, isChannel };
}

/** reply <thread> <text> and ask <thread> <question> [--choice <name>]...: one post in the thread or a new thread. */
export async function post(
  channel: Channel,
  thread: string | undefined,
  what: { text?: string } | { question?: string; choices: string[] },
): Promise<Outcome> {
  const named = target(channel, thread);
  let message: Post;
  if ("choices" in what) {
    check(what.question, `give the question, like ask ${channel.thread.form} "Merge pull request 12?"`);
    message = { question: what.question as string, choices: what.choices.length > 0 ? what.choices : CHOICES };
  } else {
    check(what.text, `give the text to post, like reply ${channel.thread.form} "On it"`);
    message = { text: what.text as string };
  }
  const posted =
    named.isChannel && channel.start
      ? await channel.start(named.name, message)
      : { thread: named.name, id: await channel.post(named.name, message) };
  return { lines: [JSON.stringify({ thread: posted.thread, id: posted.id })] };
}

/** messages <thread or channel>: one line per message, oldest first. */
export async function messages(channel: Channel, thread: string | undefined): Promise<Outcome> {
  const named = target(channel, thread);
  return { lines: (await channel.messages(named.name)).map((line) => JSON.stringify(line)) };
}
