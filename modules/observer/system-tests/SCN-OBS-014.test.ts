import { type Forge, type ModelGateway, scenario } from "@opensoftware/testkit";
import { factoryRepository, modelAnswering, propose, RESEARCH_FIX, writeProblems } from "./factory.ts";

scenario("SCN-OBS-014", async ({ sut, fakes, given, when, then }) => {
  let forge: Forge;
  await given('a Forgejo repository "tester/factory" whose "AGENTS.md" says "Investigate inline."', async () => {
    forge = await factoryRepository(fakes);
  });
  await given(
    '"problems.json" with the problem "research-skill-used" of 30 failures in 40 runs, the first of them "run-1" with the reason "Investigated inline." and the transcript "https://langfuse.example/trace/1"',
    () => writeProblems(sut),
  );

  let gateway: ModelGateway;
  await given(
    'the model gateway answers a prompt with "Investigated inline." with the solution "Tell the triage agent to use the research skill." and an edit of "AGENTS.md" from "Investigate inline." to "Use the research skill before you investigate."',
    async () => {
      gateway = await modelAnswering(fakes, RESEARCH_FIX);
    },
  );

  await when('the user runs "observer propose --repo <forge URL>/tester/factory problems.json"', async () => {
    const run = await propose(sut, forge, gateway);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('"AGENTS.md" on the branch "main" still says "Investigate inline."', async () => {
    expect(await forge.file("factory", "AGENTS.md", "main")).toBe("# Agents\n\nInvestigate inline.\n");
  });

  await then(
    'the pull request\'s branch starts with "observer/research-skill-used-" and merges into "main"',
    async () => {
      const [pr] = await forge.pullRequests("factory");
      expect(pr?.head).toMatch(/^observer\/research-skill-used-[0-9a-f]{8}$/);
      expect(pr?.base).toBe("main");
    },
  );

  await then(
    '"AGENTS.md" on the pull request\'s branch says "Use the research skill before you investigate."',
    async () => {
      const [pr] = await forge.pullRequests("factory");
      expect(await forge.file("factory", "AGENTS.md", pr?.head as string)).toBe(
        "# Agents\n\nUse the research skill before you investigate.\n",
      );
    },
  );
});
