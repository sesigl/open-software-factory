#!/usr/bin/env node
// harness-codex <command>: runs Codex through its ACP bridge behind the harness proxy (ADR 0053).
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { check } from "@opensoftware/cli";
import { runAdapter } from "@opensoftware/harness-proxy";

const USAGE = `Usage:
  harness-codex run [--allow <kinds>]       Run Codex behind the harness port on stdio.
  harness-codex transcript <session ID>     Write the session's run record and transcript to OUTPUT.
`;

const BRIDGE = fileURLToPath(import.meta.resolve("@agentclientprotocol/codex-acp/dist/index.js"));

/** Codex features that reach a service other than the model: plugins, apps, browsers, image generation, updates. */
const OFF = ["plugins", "remote_plugin", "plugin_sharing", "apps", "browser_use", "browser_use_external"].concat([
  "computer_use",
  "image_generation",
  "in_app_updates",
  "skill_mcp_dependency_install",
  "tool_suggest",
]);

/**
 * Codex's config.toml: the one model provider "osf", the gateway, on the Responses API, with no analytics, no web
 * search and no feature that calls another service. TOML takes JSON strings.
 */
const configOf = (env: NodeJS.ProcessEnv): string =>
  [
    'model_provider = "osf"',
    'web_search = "disabled"',
    "check_for_update_on_startup = false",
    "",
    "[analytics]",
    "enabled = false",
    "",
    "[features]",
    ...OFF.map((feature) => `${feature} = false`),
    "",
    "[model_providers.osf]",
    'name = "gateway"',
    `base_url = ${JSON.stringify(env.OPENAI_BASE_URL ?? "https://api.openai.com/v1")}`,
    'env_key = "OPENAI_API_KEY"',
    'wire_api = "responses"',
    "",
  ].join("\n");

const code = await runAdapter({
  harness: "codex",
  usage: USAGE,
  agent: (args, data) => {
    check(args.length === 0, "harness-codex run takes no agent command; it runs Codex");
    // Codex keeps its settings, logins and sessions in the adapter's data folder, never in the user's ~/.codex.
    const home = resolve(data, "codex");
    mkdirSync(home, { recursive: true });
    writeFileSync(join(home, "config.toml"), configOf(process.env));
    return {
      command: process.execPath,
      args: [BRIDGE],
      // Every session runs in the mode read-only: Codex asks before each edit and each command that leaves the sandbox.
      env: {
        CODEX_HOME: home,
        INITIAL_AGENT_MODE: "read-only",
        NO_BROWSER: "1",
        // The session's own settings: they win over a folder's .codex/config.toml, which may name another model.
        ...(process.env.OPENAI_MODEL ? { CODEX_CONFIG: JSON.stringify({ model: process.env.OPENAI_MODEL }) } : {}),
      },
    };
  },
  // codex-acp takes a message for a running turn as its own request; a second prompt would start another turn.
  steering: "_session/steering",
});
// The adapter ends with its agent.
process.exit(code);
