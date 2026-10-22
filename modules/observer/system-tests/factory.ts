// The background of the propose scenarios: a Forgejo repository with AGENTS.md, problems.json, and a model gateway
// that answers with a proposal.
import type { Fakes, Forge, Sut } from "@opensoftware/testkit";
import { problemsJson } from "./scores.ts";

export const FORGEJO_REPOSITORY = 'a Forgejo repository "tester/factory" whose "AGENTS.md" says "Investigate inline."';
export const PROBLEMS =
  '"problems.json" with the problem "research-skill-used" of 30 failures in 40 runs, the first of them "run-1" with the reason "Investigated inline." and the transcript "https://langfuse.example/trace/1"';
export const PROPOSE = 'the user runs "observer propose --repo <forge URL>/tester/factory problems.json"';

export async function factoryRepository(fakes: Fakes): Promise<Forge> {
  const forge = await fakes.forge();
  await forge.createRepository("factory", { "AGENTS.md": "# Agents\n\nInvestigate inline.\n" });
  return forge;
}

export const writeProblems = (sut: Sut) => sut.files.put("$INPUT/problems.json", problemsJson(30, 40));

/** A gateway that answers a prompt about the problem with this proposal. */
export const modelAnswering = (fakes: Fakes, proposal: unknown, fenced = false) =>
  fakes.modelGateway([
    {
      when: "Investigated inline.",
      reply: fenced
        ? `Here is the fix:\n\n\`\`\`json\n${JSON.stringify(proposal)}\n\`\`\`\n`
        : JSON.stringify(proposal),
    },
  ]);

export const propose = (sut: Sut, forge: Forge, gateway: { url: string }) =>
  sut.cli(["propose", "--repo", `${forge.url}/tester/factory`, "problems.json"], {
    env: { OBSERVER_INFERENCE_URL: gateway.url, OBSERVER_FORGE_TOKEN: forge.token },
  });

export const RESEARCH_FIX = {
  solution: "Tell the triage agent to use the research skill.",
  edits: [{ path: "AGENTS.md", old: "Investigate inline.", new: "Use the research skill before you investigate." }],
};
export const RESEARCH_FIX_STEP =
  'the model gateway answers a prompt with "Investigated inline." with the solution "Tell the triage agent to use the research skill." and an edit of "AGENTS.md" from "Investigate inline." to "Use the research skill before you investigate."';
