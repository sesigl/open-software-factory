#!/usr/bin/env node
// sandbox-kubernetes <command>: the entry layer only parses arguments and calls the commands (ADR 0055).
import { parseArgs } from "node:util";
import { type Command, runProgram } from "@opensoftware/cli";
import { kubectl } from "./adapters/kubectl.ts";
import { copy } from "./commands/copy.ts";
import { create } from "./commands/create.ts";
import { destroy } from "./commands/destroy.ts";
import { egressLog } from "./commands/egress-log.ts";
import { exec } from "./commands/exec.ts";
import { list } from "./commands/list.ts";
import type { Context } from "./commands/sandbox.ts";
import { snapshot } from "./commands/snapshot.ts";
import { settingsOf } from "./domain/settings.ts";

const USAGE = `Usage: sandbox-kubernetes <command>

Commands:
  create <spec.json>          Start a sandbox from a sandbox spec and print its ID.
  exec <ID> -- <command>...   Run the command in the sandbox's /workspace and exit with its code.
  copy <from> <to>            Copy a file or folder into or out of a sandbox; the sandbox's side is <ID>:<path>.
  snapshot <ID>               Save the sandbox's /workspace and print a SandboxTemplate that create accepts.
  destroy <ID>                Remove the sandbox and all its data.
  list                        Print the IDs of the sandboxes.
  egress-log <ID>             Print one JSON line per request that left the sandbox.
`;

const { positionals, values } = parseArgs({ allowPositionals: true, options: { help: { type: "boolean" } } });
const [name, first, second, ...rest] = positionals;
const settings = settingsOf(process.env);
const context: Context = { kube: kubectl(settings.namespace), settings };

const commands: Record<string, Command> = {
  create: () => create(context, first),
  exec: () =>
    exec(
      context,
      first,
      [second, ...rest].filter((part) => part !== undefined),
    ),
  copy: () => copy(context, first, second),
  snapshot: () => snapshot(context, first),
  destroy: () => destroy(context, first),
  list: () => list(context),
  "egress-log": () => egressLog(context, first),
};

process.exitCode = await runProgram({
  name: "sandbox-kubernetes",
  usage: USAGE,
  command: name === undefined ? undefined : commands[name],
  help: values.help,
});
