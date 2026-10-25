// The channel port's commands around a chat (ADR 0059, ADR 0061): receive hands a delivery to the chat's webhook and
// prints what its handlers keep; reply and ask post in a thread, or start one in a channel, and print the message;
// history prints a thread's messages, or the messages that start a channel's threads.
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

/** A posted message: its ID, the thread a post to a channel started, and its time (RFC 3339), if the chat gives it. */
export interface Posted {
  id: string;
  thread?: string;
  time?: string;
}

/** A message of a thread or a channel, as history prints it. */
export interface Said {
  id: string;
  /** `<adapter>:<user ID>`. */
  person: string;
  /** RFC 3339 in UTC. */
  time: string;
  text: string;
  /** Whether the bot wrote it. */
  mine: boolean;
}

/** A form for people, like `slack:<channel>:<ts>`, and the pattern that checks it. */
export interface Form {
  form: string;
  pattern: RegExp;
}

export interface Channel {
  /** The program's name, like `channel-slack`. Every error starts with it. */
  name: string;
  /** A thread's form. */
  thread: Form;
  /** A channel's form, for a chat whose posts to a channel start a thread, like `slack:<channel>`. */
  channel?: Form;
  /** One sentence about the chat's API, like "CHANNEL_API_URL is Slack's Web API, by default https://slack.com/api/." */
  api: string;
  /**
   * Registers the handlers of one delivery, which give their lines to `keep`, and gives the chat's webhook. A
   * person's message in one of the threads in `follow` is a line too.
   */
  receive(keep: Keep, follow: string[]): Promise<Webhook>;
  /** Posts in the thread, or starts a thread in the channel, and gives the posted message. */
  post(target: string, post: Post): Promise<Posted>;
  /** The messages of the thread, or those that start the channel's threads, oldest first. */
  history(target: string): Promise<Said[]>;
}

/** The choices of an approval card when ask names none. */
const CHOICES = ["approve", "reject"];

const isThread = (channel: Channel, name: string | undefined): name is string =>
  name !== undefined && channel.thread.pattern.test(name);

/** Checks a target of reply, ask or history: a thread, or a channel when the chat has channels. */
function target(channel: Channel, name: string | undefined): string {
  const named = isThread(channel, name) || (name !== undefined && channel.channel?.pattern.test(name));
  const forms = channel.channel ? ` or the channel as ${channel.channel.form}` : "";
  check(named, `name the thread as ${channel.thread.form}${forms}`);
  return name as string;
}

/** receive <delivery.json> [--thread <thread>]...: what the chat's handlers keep for the delivery. */
export async function receive(channel: Channel, file: string | undefined, follow: string[] = []): Promise<Outcome> {
  check(file, "name the delivery file, like receive delivery.json");
  for (const thread of follow) check(isThread(channel, thread), `name each --thread as ${channel.thread.form}`);
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
  const webhook = await channel.receive(keep, follow);
  const tasks: Promise<unknown>[] = [];
  const request = new Request("http://channel.invalid/", { method: "POST", headers, body });
  const answer = await webhook(request, { waitUntil: (task) => void tasks.push(task) });
  if (answer.status === 401) throw new Error("the delivery's signature does not match CHANNEL_SIGNING_SECRET");
  await Promise.all(tasks);
  if (failures.length > 0) throw failures[0];
  return { lines };
}

/** reply <target> <text> and ask <target> <question> [--choice <name>]...: one post in the thread or the channel. */
export async function post(
  channel: Channel,
  name: string | undefined,
  what: { text?: string } | { question?: string; choices: string[] },
): Promise<Outcome> {
  const named = target(channel, name);
  let posted: Posted;
  if ("choices" in what) {
    check(what.question, `give the question, like ask ${channel.thread.form} "Merge pull request 12?"`);
    const choices = what.choices.length > 0 ? what.choices : CHOICES;
    posted = await channel.post(named, { question: what.question as string, choices });
  } else {
    check(what.text, `give the text to post, like reply ${channel.thread.form} "On it"`);
    posted = await channel.post(named, { text: what.text as string });
  }
  const line = { thread: posted.thread ?? named, id: posted.id, ...(posted.time && { time: posted.time }) };
  return { lines: [JSON.stringify(line)] };
}

/** history <target>: one line per message, oldest first. */
export async function history(channel: Channel, name: string | undefined): Promise<Outcome> {
  const said = await channel.history(target(channel, name));
  return { lines: said.map(({ id, person, time, text, mine }) => JSON.stringify({ id, person, time, text, mine })) };
}
