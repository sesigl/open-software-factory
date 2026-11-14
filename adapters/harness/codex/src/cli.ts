#!/usr/bin/env node
// harness-codex <command>: runs Codex through its ACP bridge behind the harness proxy (ADR 0053).
import { execFileSync } from "node:child_process";
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
const OFF = [
  "plugins",
  "remote_plugin",
  "plugin_sharing",
  "apps",
  "browser_use",
  "browser_use_external",
  "computer_use",
  "image_generation",
  "in_app_updates",
  "skill_mcp_dependency_install",
  "tool_suggest",
];

/**
 * Codex's config.toml: the one model provider "osf", the gateway, on the Responses API, with no analytics, no web
 * search and no feature that calls another service. TOML takes JSON strings.
 */
const configOf = (env: NodeJS.ProcessEnv, catalog: string | undefined): string =>
  [
    'model_provider = "osf"',
    ...(catalog ? [`model_catalog_json = ${JSON.stringify(catalog)}`] : []),
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

interface Catalog {
  models: { slug: string; base_instructions: string; tool_mode?: string }[];
}

/**
 * Codex offers its edit tool apply_patch only to the models of its catalog. For a model it does not know, the catalog
 * file `models.json` in `home`: Codex's bundled catalog and that model, with the metadata Codex gives an unknown model
 * (its model_info_from_slug) and apply_patch, with the instructions of a model that calls tools directly, not in
 * code mode. Undefined when there is no model or Codex knows it.
 */
function catalogOf(model: string | undefined, home: string): string | undefined {
  if (!model) return undefined;
  const bundled = execFileSync(process.execPath, [BRIDGE, "cli", "debug", "models", "--bundled"], {
    env: { PATH: process.env.PATH ?? "", HOME: home, CODEX_HOME: home },
    encoding: "utf8",
  });
  const catalog = JSON.parse(bundled) as Catalog;
  const direct = catalog.models.find((known) => known.tool_mode === undefined);
  if (!direct || catalog.models.some((known) => known.slug === model)) return undefined;
  const unknown = {
    slug: model,
    display_name: model,
    description: null,
    supported_reasoning_levels: [],
    shell_type: "unified_exec",
    visibility: "none",
    supported_in_api: true,
    priority: 99,
    availability_nux: null,
    upgrade: null,
    support_verbosity: false,
    default_verbosity: null,
    apply_patch_tool_type: "freeform",
    web_search_tool_type: "text",
    truncation_policy: { mode: "bytes", limit: 10_000 },
    supports_image_detail_original: false,
    context_window: 272_000,
    max_context_window: 272_000,
    effective_context_window_percent: 95,
    experimental_supported_tools: [],
    base_instructions: direct.base_instructions,
  };
  const file = join(home, "models.json");
  writeFileSync(file, JSON.stringify({ ...catalog, models: [...catalog.models, unknown] }));
  return file;
}

/** The model and, from the port's OSF_EFFORT (ADR 0078), the reasoning effort of every session, as CODEX_CONFIG. */
const sessionConfig = (env: NodeJS.ProcessEnv): string =>
  JSON.stringify({ model: env.OPENAI_MODEL, model_reasoning_effort: env.OSF_EFFORT });

const code = await runAdapter({
  harness: "codex",
  usage: USAGE,
  agent: (args, data) => {
    check(args.length === 0, "harness-codex run takes no agent command; it runs Codex");
    // Codex keeps its settings, logins and sessions in the adapter's data folder, never in the user's ~/.codex.
    const home = resolve(data, "codex");
    mkdirSync(home, { recursive: true });
    writeFileSync(join(home, "config.toml"), configOf(process.env, catalogOf(process.env.OPENAI_MODEL, home)));
    return {
      command: process.execPath,
      args: [BRIDGE],
      // Every session runs in the mode read-only: Codex asks before each edit and each command that leaves the sandbox.
      env: {
        CODEX_HOME: home,
        INITIAL_AGENT_MODE: "read-only",
        NO_BROWSER: "1",
        // The session's own settings: they win over a folder's .codex/config.toml, which may name another model.
        CODEX_CONFIG: sessionConfig(process.env),
      },
    };
  },
  // codex-acp takes a message for a running turn as its own request; a second prompt would start another turn.
  steering: "_session/steering",
});
// The adapter ends with its agent.
process.exit(code);
