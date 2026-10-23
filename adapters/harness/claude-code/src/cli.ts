#!/usr/bin/env node
// harness-claude-code <command>: runs Claude Code through its ACP bridge behind the harness proxy (ADR 0051).
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { NewSessionRequest } from "@agentclientprotocol/sdk";
import { check } from "@opensoftware/cli";
import { runAdapter } from "@opensoftware/harness-proxy";

const USAGE = `Usage:
  harness-claude-code run [--allow <kinds>]       Run Claude Code behind the harness port on stdio.
  harness-claude-code transcript <session ID>     Write the session's run record and transcript to OUTPUT.
`;

const BRIDGE = fileURLToPath(import.meta.resolve("@agentclientprotocol/claude-agent-acp/dist/index.js"));

/** A session may never skip Claude Code's permission requests, whatever the client asks for. */
function withoutBypass(params: NewSessionRequest): NewSessionRequest {
  const meta = params._meta ?? {};
  const claudeCode = (meta.claudeCode ?? {}) as { options?: Record<string, unknown> };
  const options = { ...claudeCode.options, allowDangerouslySkipPermissions: false };
  return { ...params, _meta: { ...meta, claudeCode: { ...claudeCode, options } } };
}

const code = await runAdapter({
  harness: "claude-code",
  usage: USAGE,
  agent: (args, data) => {
    check(args.length === 0, "harness-claude-code run takes no agent command; it runs Claude Code");
    return {
      command: process.execPath,
      args: [BRIDGE],
      // Claude Code reads and keeps its user settings, logins and memory in the adapter's data folder, not in the
      // user's home, and calls only the model.
      env: { CLAUDE_CONFIG_DIR: resolve(data, "claude"), CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1" },
    };
  },
  newSession: withoutBypass,
});
// The adapter ends with its agent.
process.exit(code);
