#!/usr/bin/env node
// harness-opencode <command>: runs opencode's own ACP server behind the harness proxy (ADR 0053).
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { check } from "@opensoftware/cli";
import { runAdapter } from "@opensoftware/harness-proxy";

const USAGE = `Usage:
  harness-opencode run [--allow <kinds>]       Run opencode behind the harness port on stdio.
  harness-opencode transcript <session ID>     Write the session's run record and transcript to OUTPUT.
`;

/** The opencode binary of this platform, from the package that opencode-ai installs for it. */
function binary(): string {
  const platform = process.platform === "win32" ? "windows" : process.platform;
  const fromOpencode = createRequire(createRequire(import.meta.url).resolve("opencode-ai/package.json"));
  const folder = dirname(fromOpencode.resolve(`opencode-${platform}-${process.arch}/package.json`));
  return join(folder, "bin", platform === "windows" ? "opencode.exe" : "opencode");
}

/** Reading, searching and the todo list run without asking; every other tool asks; the web is denied. */
const PERMISSION = {
  "*": "ask",
  ...Object.fromEntries(["read", "glob", "grep", "list", "todowrite"].map((tool) => [tool, "allow"])),
  webfetch: "deny",
  websearch: "deny",
};

/**
 * opencode's configuration: the one provider "osf" for the gateway, the permissions for every built-in agent, which
 * win over a folder's `.opencode/` settings, and no title call, update or share.
 */
const configOf = (model: string, baseURL: string) => ({
  model: `osf/${model}`,
  small_model: `osf/${model}`,
  autoupdate: false,
  share: "disabled",
  provider: {
    osf: {
      npm: "@ai-sdk/openai-compatible",
      name: "gateway",
      options: { baseURL, apiKey: "{env:OPENAI_API_KEY}" },
      models: { [model]: { name: model } },
    },
  },
  permission: PERMISSION,
  default_agent: "build",
  agent: {
    ...Object.fromEntries(["build", "plan", "general", "explore"].map((agent) => [agent, { permission: PERMISSION }])),
    title: { disable: true },
  },
});

const code = await runAdapter({
  harness: "opencode",
  usage: USAGE,
  agent: (args, data) => {
    check(args.length === 0, "harness-opencode run takes no agent command; it runs opencode");
    const model = process.env.OPENAI_MODEL;
    check(model !== undefined, "set OPENAI_MODEL to the model opencode calls");
    const base = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
    // opencode keeps its settings, logins and sessions in the adapter's data folder, never in the user's home.
    const home = resolve(data, "opencode");
    const xdg = Object.fromEntries(
      ["config", "data", "cache", "state"].map((kind) => [`XDG_${kind.toUpperCase()}_HOME`, join(home, kind)]),
    );
    const off = Object.fromEntries(
      ["PROJECT_CONFIG", "AUTOUPDATE", "MODELS_FETCH", "LSP_DOWNLOAD", "CLAUDE_CODE", "EXTERNAL_SKILLS"].map((flag) => [
        `OPENCODE_DISABLE_${flag}`,
        "1",
      ]),
    );
    return {
      command: binary(),
      args: ["acp", "--pure"],
      env: {
        ...xdg,
        ...off,
        OPENCODE_CONFIG_CONTENT: JSON.stringify(configOf(model, base)),
        // opencode installs its plugin package into each config folder with npm; offline, with a cache of its own,
        // that install finds nothing and calls no registry.
        npm_config_offline: "true",
        npm_config_cache: join(home, "npm"),
      },
    };
  },
});
// The adapter ends with its agent.
process.exit(code);
