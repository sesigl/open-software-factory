// A Slack channel through the channel port (ADR 0062): the request is a message at the top of the channel, decisions
// are replies in its thread or presses of its buttons. The adapter program talks to Slack.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Channel, Message } from "../domain/gate.ts";
import { fromIso } from "../domain/time.ts";
import type { Program } from "./program.ts";

/** A line of the port's `messages`; a request's ID is its thread, so status and serve read and answer there. */
const message = (line: Record<string, unknown>, id = String(line.id)): Message => ({
  id,
  author: String(line.author),
  time: fromIso(String(line.time)),
  text: String(line.text ?? ""),
  mine: line.mine === true,
});

export function slackChannel(channel: string, run: Program): Channel {
  const name = `slack:${channel}`;
  const render = (text: string, marker: string): string => `${text}\n[${marker}]`;
  return {
    name,
    mention: (identity) => (identity.startsWith("slack:") ? `<@${identity.slice(6)}>` : identity),
    howToDecide: 'Reply "approve" or "reject <reason>" in this thread.',
    async find(marker) {
      const found = (await run(["messages", name])).find(
        (line) => line.mine === true && String(line.text).includes(`[${marker}]`),
      );
      return found && message(found, String(found.thread));
    },
    async thread(request) {
      // The port lists the thread from its first message, the request.
      return (await run(["messages", request.id])).slice(1).map((line) => message(line));
    },
    async ask(text, marker, choices = []) {
      const body = render(text, marker);
      const [posted] = choices.length
        ? await run(["ask", name, body, ...choices.flatMap((choice) => ["--choice", choice])])
        : await run(["reply", name, body]);
      const thread = String(posted?.thread);
      const [first] = await run(["messages", thread]);
      if (!first) throw new Error(`${name} shows no message in the new thread ${thread}`);
      return message(first, thread);
    },
    async answer(request, text, marker) {
      await run(["reply", request.id, render(text, marker)]);
    },
  };
}

/** What the adapter's `receive` makes of one request from Slack; a signature it refuses is undefined. */
export async function receive(
  run: Program,
  delivery: { headers: Record<string, string>; body: string },
): Promise<Record<string, unknown>[] | undefined> {
  const folder = await mkdtemp(join(tmpdir(), "gatekeeper-"));
  try {
    const file = join(folder, "delivery.json");
    await writeFile(file, JSON.stringify(delivery));
    const refused = (error: Error) => (error.message.includes("signature") ? undefined : Promise.reject(error));
    return await run(["receive", file]).catch(refused);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
