// The stop check in the scenarios (ADR 0168): an agent with the stop check "make check-fast" and the Stop hook that
// "factory render" writes for it into Claude Code's .claude/settings.json.
import type { Sut } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

/** The lines of an agent's stop check, two spaces below the agent. */
export const STOP_CHECK = ["stopCheck:", "  command: make check-fast"];

/** Puts a factory.yaml whose agent `name` has the stop check "make check-fast", and the agent's prompt. */
export async function putStopCheck(sut: Sut, name: string, providers?: string[]): Promise<void> {
  await sut.files.put("$INPUT/factory.yaml", factoryYaml({ providers, agents: agent(name, STOP_CHECK) }));
  await sut.files.put(`$INPUT/agents/${name}.md`, prompt(name));
}

interface Settings {
  permissions?: { allow?: string[] };
  hooks?: Record<string, { matcher?: string; hooks: { type: string; command: string }[] }[]>;
}

/** .claude/settings.json in the output folder. */
export async function settings(sut: Sut): Promise<Settings> {
  return JSON.parse(await sut.files.read("$OUTPUT/.claude/settings.json")) as Settings;
}

/** The commands of the Stop hooks in .claude/settings.json of the output folder. */
export async function stopCommands(sut: Sut): Promise<string[]> {
  return ((await settings(sut)).hooks?.Stop ?? []).flatMap((entry) => entry.hooks.map((hook) => hook.command));
}
