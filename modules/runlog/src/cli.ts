#!/usr/bin/env node
// runlog <command>: the entry layer only parses arguments and calls the commands.
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { exportSession } from "./commands/export.ts";

const HELP = `Usage: runlog <command> [options]

Commands:
  export <session file> [--include-content]  Write a Claude Code or Codex session as an OTLP run to $OUTPUT/runs.jsonl, or send it to OTEL_EXPORTER_OTLP_ENDPOINT.
`;

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  version: string;
};
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { help: { type: "boolean" }, "include-content": { type: "boolean" } },
});
const [command, file] = positionals;

if (command === "export" && file && !values.help) {
  const { OUTPUT, OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_TRACES_ENDPOINT } = process.env;
  exportSession(file, {
    includeContent: values["include-content"] ?? false,
    output: OUTPUT ?? ".",
    endpoint: OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || OTEL_EXPORTER_OTLP_ENDPOINT,
    version,
  }).then(
    (line) => process.stdout.write(`${line}\n`),
    (error: Error) => {
      process.stderr.write(`runlog: ${error.message}\n`);
      process.exitCode = 1;
    },
  );
} else {
  (values.help ? process.stdout : process.stderr).write(HELP);
  process.exitCode = values.help ? 0 : 2;
}
