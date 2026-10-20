#!/usr/bin/env node
// spec-trace <command>: the entry layer only parses arguments and calls the commands.
import { join } from "node:path";
import { parseArgs } from "node:util";
import { check } from "./commands/check.ts";
import { load } from "./commands/load.ts";
import { next } from "./commands/next-id.ts";
import { writeReport } from "./commands/report.ts";

const HELP = `Usage: spec-trace <command> [options]

Commands:
  check [--only <rules>] [--config <file>]  Check the rules SPEC, TRACE, STEPS and PASS (or the comma-separated --only) on the repository in the current folder. Prints one line per finding and exits 1 when there is one.
  report [--out <file>] [--evidence <bundle>]... [--config <file>]  Write the JSON report of every scenario, its tests, its result and its evidence in proof bundles to --out ($OUTPUT/spec-trace.json).
  next-id <prefix> [--config <file>]  Print the next free scenario ID of the prefix.
`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    help: { type: "boolean" },
    only: { type: "string" },
    config: { type: "string" },
    out: { type: "string" },
    evidence: { type: "string", multiple: true },
  },
});
const [command, prefix] = positionals;
const root = process.cwd();

const commands: Record<string, () => string> = {
  check: () => {
    const { lines, ok } = check(load(root, values.config), values.only);
    if (!ok) process.exitCode = 1;
    return lines.join("\n");
  },
  report: () =>
    writeReport(
      load(root, values.config),
      values.out ?? join(process.env.OUTPUT ?? ".", "spec-trace.json"),
      values.evidence ?? [],
    ),
  "next-id": () => next(load(root, values.config), prefix as string),
};
const ready = command === "check" || command === "report" || (command === "next-id" && prefix);
const chosen = ready && !values.help ? commands[command as string] : undefined;

if (chosen) {
  try {
    process.stdout.write(`${chosen()}\n`);
  } catch (error) {
    process.stderr.write(`spec-trace: ${(error as Error).message}\n`);
    process.exitCode = 2;
  }
} else {
  (values.help ? process.stdout : process.stderr).write(HELP);
  process.exitCode = values.help ? 0 : 2;
}
