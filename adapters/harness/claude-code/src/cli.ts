#!/usr/bin/env node
// harness-claude-code <command>: runs Claude Code through its ACP bridge behind the harness proxy (ADR 0052).
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

/**
 * On a subscription (ADR 0080): Claude Code sends the subscription's token to Anthropic as `Authorization`, so the
 * gateway's key moves from ANTHROPIC_API_KEY, which would replace the subscription, to the gateway's own header.
 */
function subscriptionEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const key = env.ANTHROPIC_API_KEY;
  if (!env.CLAUDE_CODE_OAUTH_TOKEN || !key) return {};
  const headers = [env.ANTHROPIC_CUSTOM_HEADERS, `x-litellm-api-key: Bearer ${key}`].filter(Boolean).join("\n");
  return { ANTHROPIC_API_KEY: "", ANTHROPIC_CUSTOM_HEADERS: headers };
}

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
      // OSF_EFFORT is the port's effort level (ADR 0078); Claude Code's own variable wins over its settings files.
      env: {
        CLAUDE_CONFIG_DIR: resolve(data, "claude"),
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
        ...(process.env.OSF_EFFORT ? { CLAUDE_CODE_EFFORT_LEVEL: process.env.OSF_EFFORT } : {}),
        ...subscriptionEnv(process.env),
      },
    };
  },
  newSession: withoutBypass,
});
// The adapter ends with its agent.
process.exit(code);
