#!/usr/bin/env node
// harness-claude-code <command>: runs Claude Code through its ACP bridge behind the harness proxy (ADR 0051).
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import type { NewSessionRequest } from "@agentclientprotocol/sdk";
import { type Command, check, runProgram } from "@opensoftware/cli";
import { allowlistOf, exportTranscript, serveProxy } from "@opensoftware/harness-proxy";

const USAGE = `Usage:
  harness-claude-code run [--allow <kinds>]       Run Claude Code behind the harness port on stdio.
  harness-claude-code transcript <session ID>     Write the session's run record and transcript to OUTPUT.
`;

const BRIDGE = fileURLToPath(import.meta.resolve("@agentclientprotocol/claude-agent-acp/dist/index.js"));

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { allow: { type: "string" }, help: { type: "boolean" } },
});
const [name, ...rest] = positionals;
const data = process.env.OSF_DATA ?? ".harness-claude-code";

/** A session may never skip Claude Code's permission requests, whatever the client asks for. */
function withoutBypass(params: NewSessionRequest): NewSessionRequest {
  const meta = params._meta ?? {};
  const claudeCode = (meta.claudeCode ?? {}) as { options?: Record<string, unknown> };
  const options = { ...claudeCode.options, allowDangerouslySkipPermissions: false };
  return { ...params, _meta: { ...meta, claudeCode: { ...claudeCode, options } } };
}

const run = async () => {
  check(rest.length === 0, "harness-claude-code run takes no agent command; it runs Claude Code");
  await serveProxy({
    agent: {
      command: process.execPath,
      args: [BRIDGE],
      // Claude Code reads and keeps its user settings, logins and memory in the adapter's data folder, not in the
      // user's home, and calls only the model.
      env: { CLAUDE_CONFIG_DIR: resolve(data, "claude"), CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1" },
    },
    allow: allowlistOf(values.allow),
    data,
    newSession: withoutBypass,
  });
  // The adapter ends with its agent.
  process.exit(0);
};

const transcript = () => {
  const [sessionId] = rest;
  check(sessionId !== undefined, "name the session ID");
  const output = process.env.OUTPUT ?? ".";
  const written = exportTranscript({ sessionId: sessionId as string, data, output, harness: "claude-code" });
  return { lines: [`wrote ${written.recordFile}`, `wrote ${written.transcriptFile}`] };
};

const commands: Record<string, Command> = { run, transcript };
process.exitCode = await runProgram({
  name: "harness-claude-code",
  usage: USAGE,
  command: commands[name as string],
  help: values.help,
});
