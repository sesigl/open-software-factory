// runChannel: the command line of a channel adapter, from its arguments to its exit code (ADR 0059, ADR 0061).
import { parseArgs } from "node:util";
import { type Command, type Io, runProgram } from "@opensoftware/cli";
import { type Channel, history, post, receive } from "./commands.ts";

/** Runs `receive`, `reply`, `ask` or `history` of the channel with the arguments and returns the exit code. */
export function runChannel(channel: Channel, args = process.argv.slice(2), io: Io = process): Promise<number> {
  const forms = channel.channel ? ` A channel is ${channel.channel.form}; a post there starts a thread.` : "";
  const usage = `Usage: ${channel.name} <command>

Commands:
  receive <delivery.json> [--thread <thread>]...  Print the delivery's work item or decision, if any, and a
                                                 person's message in a thread named with --thread.
  reply <thread> <text>                          Post the text in the thread; print {"thread", "id", "time"}.
  ask <thread> <question> [--choice <name>]...   Post an approval card; print {"thread", "id", "time"}.
  history <thread>                               Print the thread's messages, oldest first.

A thread is ${channel.thread.form}.${forms} ${channel.api}
`;
  const { positionals: words, values: flags } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      help: { type: "boolean" },
      choice: { type: "string", multiple: true },
      thread: { type: "string", multiple: true },
    },
  });
  const [name, ...rest] = words;
  const [a, b] = rest;
  const commands: Record<string, [arity: number, Command]> = {
    receive: [1, () => receive(channel, a, flags.thread ?? [])],
    reply: [2, () => post(channel, a, { text: b })],
    ask: [2, () => post(channel, a, { question: b, choices: flags.choice ?? [] })],
    history: [1, () => history(channel, a)],
  };
  const chosen = name === undefined ? undefined : commands[name];
  return runProgram(
    {
      name: channel.name,
      usage,
      command: chosen && rest.length <= chosen[0] ? chosen[1] : undefined,
      help: flags.help,
    },
    io,
  );
}
