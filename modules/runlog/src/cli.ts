#!/usr/bin/env node
// runlog <command>: the entry layer only parses arguments and calls the commands.
import { parseArgs } from "node:util";
import { type Command, packageVersion, runProgram } from "@opensoftware/cli";
import { attachSession } from "./commands/attach.ts";
import { collectorConfig } from "./commands/collector.ts";
import { type ExportOptions, exportLatest, exportSession } from "./commands/export.ts";
import { watchFolders } from "./commands/watch.ts";

const HELP = `Usage: runlog <command> [options]

Commands:
  export <session file> [--include-content] [--agent-trace <file>] [--per-run]  Write a Claude Code, Codex or OpenCode session as an OTLP run to $OUTPUT/runs.jsonl, or send it to OTEL_EXPORTER_OTLP_ENDPOINT. --agent-trace also writes the Agent Trace record of the lines it wrote. --per-run writes $OUTPUT/<run id>.jsonl and replaces it.
  export --latest <folder>... [options]  Export like export the session below the folders whose last event is the latest.
  attach <session file> [--outcome <outcome>] [--include-content] [--agent-trace <file>]  Export like export, but into the trace of the launcher's TRACEPARENT, with the outcome succeeded, failed or cancelled.
  watch <folder>... [--idle <minutes>] [--passes <n>] [--interval <seconds>] [--include-content]  Export each session below the folders once, when its last event is --idle minutes (5) old; repeat every --interval seconds (60).
  collector <harness>  Write the OpenTelemetry Collector config of claude-code, codex or opencode to $OUTPUT/collector.yaml. It renames the harness's native spans to invoke_agent, chat and execute_tool and sends them to OTEL_EXPORTER_OTLP_ENDPOINT.
`;

const version = packageVersion(new URL("../package.json", import.meta.url));
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    help: { type: "boolean" },
    "include-content": { type: "boolean" },
    "agent-trace": { type: "string" },
    outcome: { type: "string" },
    latest: { type: "boolean" },
    "per-run": { type: "boolean" },
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
  perRun: values["per-run"] ?? false,
};

/** The one line that export, attach and collector print. */
const print = (text: string) => ({ lines: [text] });
const commands: Record<string, Command> = {
  export: async () =>
    print(await (values.latest ? exportLatest(rest, options) : exportSession(file as string, options))),
  attach: async () => print(await attachSession(file as string, TRACEPARENT, values.outcome, options)),
  watch: async () => {
    const watch = {
      idle: Number(values.idle ?? 5),
      passes: Number(values.passes ?? Number.POSITIVE_INFINITY),
      interval: Number(values.interval ?? 60),
      now: () => (OSF_NOW ? Date.parse(OSF_NOW) : Date.now()),
    };
    await watchFolders(rest, watch, options);
    return {};
  },
  collector: async () => print(collectorConfig(file as string, options.output)),
};
const chosen = command && file ? commands[command] : undefined;
process.exitCode = await runProgram({ name: "runlog", usage: HELP, command: chosen, help: values.help });
