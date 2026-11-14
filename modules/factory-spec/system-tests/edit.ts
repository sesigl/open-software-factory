// The factories of the edit scenarios, and "factory resolve" of the text that "factory edit" printed. System tests may
// not parse YAML (BOUNDARY-STATIC), so they read the edited values through the CLI.
import type { CliResult, Sut } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

const NAMES = ["triage", "spec", "review"];

/** Like the reference factory: comments, and "spec" and "review" share the secrets and the sandbox of "triage". */
export const SHARED = [
  "# The factory of the web-app team.",
  "version: 1",
  "factory: web-app",
  "providers:",
  "  harness:",
  '    claude-code: "^2"',
  "  # The agents' secrets are variables of the foreman.",
  "  secrets:",
  '    env: "^0"',
  "# Every agent uses the secrets and the sandbox of triage.",
  "agents:",
  "  triage:",
  "    harness: claude-code",
  "    model: routes/triage",
  "    effort: medium",
  "    prompt: ./agents/triage.md",
  "    secrets: &secrets [ref:env/GH_TOKEN, ref:env/CLAUDE_CODE_OAUTH_TOKEN]",
  "    sandbox: &sandbox",
  "      template: node-24",
  "      # The model gateway and the forge.",
  "      egress:",
  "        - litellm",
  "        - github.com",
  ...NAMES.slice(1).flatMap((name) => [
    `  ${name}:`,
    "    harness: claude-code",
    `    model: routes/${name}`,
    "    effort: medium",
    `    prompt: ./agents/${name}.md`,
    "    secrets: *secrets",
    "    sandbox: *sandbox",
  ]),
  "",
].join("\n");

export const COMMENTS = SHARED.split("\n").filter((line) => line.trim().startsWith("#"));

export async function putShared(sut: Sut): Promise<void> {
  await sut.files.put("$INPUT/factory.yaml", SHARED);
  for (const name of NAMES) await sut.files.put(`$INPUT/agents/${name}.md`, prompt(name));
}

/** The factory "web-app" with the agent "triage" and the extra lines; returns the text of its factory.yaml. */
export async function putTriage(sut: Sut, extra: string[], providers?: string[]): Promise<string> {
  const yaml = factoryYaml({ providers, agents: agent("triage", extra) });
  await sut.files.put("$INPUT/factory.yaml", yaml);
  await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
  return yaml;
}

/** A provider "env" at "^0" under providers.secrets, and the agent "triage" with a padded flow list of one secret. */
export const putEnvSecret = (sut: Sut): Promise<string> =>
  putTriage(sut, ["secrets: [ ref:env/GH_TOKEN ]"], ["harness:", '  claude-code: "^2"', "secrets:", '  env: "^0"']);

interface Resolved {
  providers: Record<string, Record<string, string>>;
  agents: Record<string, { skills?: string[]; secrets?: string[]; sandbox?: { egress?: string[] } }>;
}

/** "factory resolve" of the text that "factory edit" printed, written next to factory.yaml. */
export async function resolved(sut: Sut, run: CliResult): Promise<Resolved> {
  expect(run.exitCode, run.stderr).toBe(0);
  await sut.files.put("$INPUT/edited.yaml", run.stdout);
  const resolve = await sut.cli(["resolve", "--file", "edited.yaml"]);
  expect(resolve.exitCode, resolve.stderr).toBe(0);
  return JSON.parse(resolve.stdout) as Resolved;
}

/** The lines of an agent's block in YAML text, from its key to the next agent. */
export function block(text: string, name: string): string {
  return text.split(/^(?= {2}\S+:$)/m).find((part) => part.startsWith(`  ${name}:\n`)) ?? "";
}

export const USAGE =
  "usage: factory edit add-skill|remove-skill|add-secret|remove-secret|add-egress|remove-egress <agent> <value>, or factory edit add-secrets-provider <name> <range>\n";
