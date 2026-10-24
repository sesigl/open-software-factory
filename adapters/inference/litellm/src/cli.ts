#!/usr/bin/env node
// inference-litellm <command>: the entry layer only parses arguments and calls the commands (ADR 0056).
import { parseArgs } from "node:util";
import { type Command, runProgram } from "@opensoftware/cli";
import { key } from "./commands/key.ts";
import { list } from "./commands/list.ts";
import { spendLog } from "./commands/spend-log.ts";
import { start } from "./commands/start.ts";
import { stop } from "./commands/stop.ts";

const USAGE = `Usage: inference-litellm <command>

Commands:
  start <config.yaml>                      Start a gateway from a LiteLLM config; print {"id", "url"}.
  key <ID> <run ID> [--budget <USD>]       Print a key for the run, refused once its spend passed the budget.
  spend-log <ID>                           Print one JSON line per call the gateway answered.
  stop <ID>                                Remove the gateway with its keys and spend log.
  list                                     Print the IDs of the gateways.
`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { help: { type: "boolean" }, budget: { type: "string" } },
});
const [name, first, second] = positionals;

const commands: Record<string, Command> = {
  start: () => start(first),
  key: () => key(first, second, values.budget),
  "spend-log": () => spendLog(first),
  stop: () => stop(first),
  list: () => list(),
};

process.exitCode = await runProgram({
  name: "inference-litellm",
  usage: USAGE,
  command: name === undefined ? undefined : commands[name],
  help: values.help,
});
