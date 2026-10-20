#!/usr/bin/env node
// runlog <command>: the entry layer only parses arguments and calls the commands.
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { attachSession } from "./commands/attach.ts";
import { type ExportOptions, exportSession } from "./commands/export.ts";
import { watchFolders } from "./commands/watch.ts";

const HELP = `Usage: runlog <command> [options]

Commands:
  export <session file> [--include-content] [--agent-trace <file>]  Write a Claude Code, Codex or OpenCode session as an OTLP run to $OUTPUT/runs.jsonl, or send it to OTEL_EXPORTER_OTLP_ENDPOINT. --agent-trace also writes the Agent Trace record of the lines it wrote.
  attach <session file> [--outcome <outcome>] [--include-content] [--agent-trace <file>]  Export like export, but into the trace of the launcher's TRACEPARENT, with the outcome succeeded, failed or cancelled.
  watch <folder>... [--idle <minutes>] [--passes <n>] [--interval <seconds>] [--include-content]  Export each session below the folders once, when its last event is --idle minutes (5) old; repeat every --interval seconds (60).
`;

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  version: string;
};
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    help: { type: "boolean" },
    "include-content": { type: "boolean" },
    "agent-trace": { type: "string" },
    outcome: { type: "string" },
    idle: { type: "string" },
    passes: { type: "string" },
    interval: { type: "string" },
  },
});
const [command, ...rest] = positionals;
const [file] = rest;
const { OUTPUT, OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_TRACES_ENDPOINT, OSF_NOW, TRACEPARENT } = process.env;
const options: ExportOptions = {
  includeContent: values["include-content"] ?? false,
  output: OUTPUT ?? ".",
  endpoint: OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || OTEL_EXPORTER_OTLP_ENDPOINT,
  version,
  agentTrace: values["agent-trace"],
};

const commands: Record<string, () => Promise<string | undefined>> = {
  export: () => exportSession(file as string, options),
  attach: () => attachSession(file as string, TRACEPARENT, values.outcome, options),
  watch: () => {
    const watch = {
      idle: Number(values.idle ?? 5),
      passes: Number(values.passes ?? Number.POSITIVE_INFINITY),
      interval: Number(values.interval ?? 60),
      now: () => (OSF_NOW ? Date.parse(OSF_NOW) : Date.now()),
    };
    return watchFolders(rest, watch, options).then(() => undefined);
  },
};
const chosen = command && file && !values.help ? commands[command] : undefined;

if (chosen) {
  chosen().then(
    (line) => line && process.stdout.write(`${line}\n`),
    (error: Error) => {
      process.stderr.write(`runlog: ${error.message}\n`);
      process.exitCode = 1;
    },
  );
} else {
  (values.help ? process.stdout : process.stderr).write(HELP);
  process.exitCode = values.help ? 0 : 2;
}
