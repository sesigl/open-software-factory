// runChannel: the command line of a channel adapter, from its arguments to its exit code (ADR 0059).
import { parseArgs } from "node:util";
import { type Command, type Io, runProgram } from "@opensoftware/cli";
import { type Channel, messages, post, receive } from "./commands.ts";

/** Runs `receive`, `reply` or `ask` of the channel with the arguments and returns the exit code. */
export function runChannel(channel: Channel, args = process.argv.slice(2), io: Io = process): Promise<number> {
  const usage = `Usage: ${channel.name} <command>

Commands:
  receive <delivery.json>                        Print the delivery's work item or decision, if any.
  reply <thread> <text>                          Post the text in the thread; print {"thread", "id"}.
  ask <thread> <question> [--choice <name>]...   Post an approval card; print {"thread", "id"}.
  messages <thread>                              Print each message of the thread, oldest first.

A thread is ${channel.thread.form}.${channel.channel ? ` A channel, ${channel.channel.form}, takes the place of a thread: reply and ask start a new thread, messages lists its newest messages.` : ""} ${channel.api}
`;
  const { positionals: words, values: flags } = parseArgs({
    args,
    allowPositionals: true,
    options: { help: { type: "boolean" }, choice: { type: "string", multiple: true } },
  });
  const [name, ...rest] = words;
  const [a, b] = rest;
  const commands: Record<string, [arity: number, Command]> = {
    receive: [1, () => receive(channel, a)],
    reply: [2, () => post(channel, a, { text: b })],
    ask: [2, () => post(channel, a, { question: b, choices: flags.choice ?? [] })],
    messages: [1, () => messages(channel, a)],
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
