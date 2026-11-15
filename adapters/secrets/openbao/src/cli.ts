#!/usr/bin/env node
// secrets-openbao <command>: the entry layer only parses arguments and calls the commands (ADR 0137).
import { parseArgs } from "node:util";
import { type Command, runProgram } from "@opensoftware/cli";
import { remove } from "./commands/delete.ts";
import { list } from "./commands/list.ts";
import { policy } from "./commands/policy.ts";
import { probe } from "./commands/probe.ts";
import { put } from "./commands/put.ts";

const USAGE = `Usage: secrets-openbao <command>

Commands:
  put <name> --by <person>   Store the value on standard input as a new version; print {"name", "version"}.
  list                       Print each secret as {"name", "version", "changed", "by"}, sorted by name.
  delete <name>              Remove the secret with every version; print {"name", "deleted"}.
  probe                      Check that OpenBao answers to the token; print {"ttl", "expires"} of the token.
  policy write|read          Print the policy of the console's token (write) or the egress proxy's (read).

A name holds A-Z, a-z, 0-9, _, . and - in folders split by /, like team/linear-token. No command prints a value.
`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { help: { type: "boolean" }, by: { type: "string" } },
});
const [name, first] = positionals;

const commands: Record<string, Command> = {
  put: () => put(first, values.by),
  list: () => list(),
  delete: () => remove(first),
  probe: () => probe(),
  policy: () => policy(first),
};

process.exitCode = await runProgram({
  name: "secrets-openbao",
  usage: USAGE,
  command: positionals.length > 2 ? undefined : commands[name ?? ""],
  help: values.help,
});
