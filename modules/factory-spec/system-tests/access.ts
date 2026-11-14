// The factory and its access file of the scenarios of `factory lint` for access.yaml (ADR 0134).
import type { Sut } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";

/** A valid factory.yaml with the agent triage, and access.yaml with these people. */
export async function factoryWithAccess(sut: Sut, people: Record<string, string>): Promise<void> {
  await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents: agent("triage") }));
  await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
  await putAccess(sut, people);
}

/** access.yaml with these people, each by email with its role. */
export const putAccess = (sut: Sut, people: Record<string, string>) =>
  sut.files.put(
    "$INPUT/access.yaml",
    `version: 1\npeople:\n${Object.entries(people)
      .map(([email, role]) => `  - email: ${email}\n    role: ${role}\n`)
      .join("")}`,
  );
