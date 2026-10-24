#!/usr/bin/env node
// channel-slack <command>: the entry layer only reads the command line and calls a command (ADR 0059).
import { parseArgs } from "node:util";
import { type Command, runProgram } from "@opensoftware/cli";
import { ask, receive, reply } from "./commands/channel.ts";

const USAGE = `Usage: channel-slack <command>

Commands:
  receive <delivery.json>                        Print the delivery's work item or decision, if any.
  reply <thread> <text>                          Post the text in the thread; print {"thread", "id"}.
  ask <thread> <question> [--choice <name>]...   Post an approval card; print {"thread", "id"}.

A thread is slack:<channel>:<ts>. CHANNEL_API_URL is Slack's Web API, by default https://slack.com/api/.
`;

const { positionals: words, values: flags } = parseArgs({
  allowPositionals: true,
  options: { help: { type: "boolean" }, choice: { type: "string", multiple: true } },
});
const [name, ...rest] = words;
const [a, b] = rest;

const commands: Record<string, [arity: number, Command]> = {
  receive: [1, () => receive(a)],
  reply: [2, () => reply(a, b)],
  ask: [2, () => ask(a, b, flags.choice ?? [])],
};
const chosen = name === undefined ? undefined : commands[name];

process.exitCode = await runProgram({
  name: "channel-slack",
  usage: USAGE,
  command: chosen && rest.length <= chosen[0] ? chosen[1] : undefined,
  help: flags.help,
});
