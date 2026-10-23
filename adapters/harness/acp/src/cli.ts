#!/usr/bin/env node
// harness-acp <command>: the entry layer parses arguments and runs the harness proxy (ADR 0050, ADR 0051).
import { parseArgs } from "node:util";
import { type Command, check, runProgram } from "@opensoftware/cli";
import { allowlistOf, exportTranscript, serveProxy } from "@opensoftware/harness-proxy";

const USAGE = `Usage:
  harness-acp run [--allow <kinds>] -- <agent command>...   Run the ACP agent behind the harness port on stdio.
  harness-acp transcript <session ID>                       Write the session's run record and transcript to OUTPUT.
`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { allow: { type: "string" }, help: { type: "boolean" } },
});
const [name, ...rest] = positionals;
const data = process.env.OSF_DATA ?? ".harness-acp";

const run = async () => {
  check(rest.length > 0, "name the ACP agent to run after --");
  const [command, ...args] = rest as [string, ...string[]];
  await serveProxy({ agent: { command, args }, allow: allowlistOf(values.allow), data });
  // The adapter ends with its agent.
  process.exit(0);
};

const transcript = () => {
  const [sessionId] = rest;
  check(sessionId !== undefined, "name the session ID");
  const output = process.env.OUTPUT ?? ".";
  const written = exportTranscript({ sessionId: sessionId as string, data, output, harness: "acp" });
  return { lines: [`wrote ${written.recordFile}`, `wrote ${written.transcriptFile}`] };
};

const commands: Record<string, Command> = { run, transcript };
process.exitCode = await runProgram({
  name: "harness-acp",
  usage: USAGE,
  command: commands[name as string],
  help: values.help,
});
