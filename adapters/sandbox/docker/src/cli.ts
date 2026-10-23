#!/usr/bin/env node
// sandbox-docker <command>: the entry layer only parses arguments and calls the commands (ADR 0054).
import { parseArgs } from "node:util";
import { type Command, runProgram } from "@opensoftware/cli";
import { copy } from "./commands/copy.ts";
import { create } from "./commands/create.ts";
import { destroy } from "./commands/destroy.ts";
import { egressLog } from "./commands/egress-log.ts";
import { exec } from "./commands/exec.ts";
import { list } from "./commands/list.ts";
import { snapshot } from "./commands/snapshot.ts";

const USAGE = `Usage: sandbox-docker <command>

Commands:
  create <spec.json>          Start a sandbox from a sandbox spec and print its ID.
  exec <ID> -- <command>...   Run the command in the sandbox's /workspace and exit with its code.
  copy <from> <to>            Copy a file or folder into or out of a sandbox; the sandbox's side is <ID>:<path>.
  snapshot <ID>               Save the sandbox's files and print a template that create accepts.
  destroy <ID>                Remove the sandbox and all its data.
  list                        Print the IDs of the sandboxes.
  egress-log <ID>             Print one JSON line per request that left the sandbox.
`;

const { positionals, values } = parseArgs({ allowPositionals: true, options: { help: { type: "boolean" } } });
const [name, first, second, ...rest] = positionals;
const secretsDir = process.env.OSF_SECRETS_DIR ?? "/run/secrets";

const commands: Record<string, Command> = {
  create: () => create(first, secretsDir),
  exec: () =>
    exec(
      first,
      [second, ...rest].filter((part) => part !== undefined),
    ),
  copy: () => copy(first, second),
  snapshot: () => snapshot(first),
  destroy: () => destroy(first),
  list: () => list(),
  "egress-log": () => egressLog(first),
};

process.exitCode = await runProgram({
  name: "sandbox-docker",
  usage: USAGE,
  command: name === undefined ? undefined : commands[name],
  help: values.help,
});
