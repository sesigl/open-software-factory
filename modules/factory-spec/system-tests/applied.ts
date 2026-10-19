// Puts the factory "web-app" with the agent "triage" into $INPUT and applies it through the CLI.
import type { Sut } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

export async function applied(sut: Sut, options: { model?: string; promptText?: string } = {}): Promise<void> {
  await sut.files.put(
    "$INPUT/factory.yaml",
    factoryYaml({ agents: agent("triage", [], "claude-code", options.model) }),
  );
  await sut.files.put("$INPUT/agents/triage.md", options.promptText ?? prompt("triage"));
  const run = await sut.cli(["apply"]);
  expect(run.exitCode, run.stderr).toBe(0);
}
