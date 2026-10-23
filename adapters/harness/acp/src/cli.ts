#!/usr/bin/env node
// harness-acp <command>: the entry layer only parses arguments and calls the layers below it.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { type Command, check, outputPath, runProgram, writeText } from "@opensoftware/cli";
import { runProxy } from "./adapters/proxy.ts";
import { readSession } from "./adapters/store.ts";
import { allowlistOf } from "./domain/allowlist.ts";
import { runRecordOf } from "./domain/run-record.ts";
import type { SessionLine } from "./domain/session.ts";

const USAGE = `Usage:
  harness-acp run [--allow <kinds>] -- <agent command>...   Run the ACP agent behind the harness port on stdio.
  harness-acp transcript <session ID>                       Write the session's run record and transcript to OUTPUT.
`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { allow: { type: "string" }, help: { type: "boolean" } },
});
const [name, ...rest] = positionals;

const run = () => {
  check(rest.length > 0, "name the ACP agent to run after --");
  return runProxy(rest, allowlistOf(values.allow));
};

const transcript = () => {
  const [sessionId] = rest;
  check(sessionId !== undefined, "name the session ID");
  const text = readSession(sessionId as string);
  const transcriptFile = resolve(outputPath("transcript.jsonl"));
  const recordFile = resolve(outputPath("run-record.json"));
  const lines = text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as SessionLine);
  writeText(transcriptFile, text);
  writeText(recordFile, `${JSON.stringify(runRecordOf(lines, pathToFileURL(transcriptFile).href), null, 2)}\n`);
  return { lines: [`wrote ${recordFile}`, `wrote ${transcriptFile}`] };
};

const commands: Record<string, Command> = { run, transcript };
process.exitCode = await runProgram({
  name: "harness-acp",
  usage: USAGE,
  command: commands[name as string],
  help: values.help,
});
