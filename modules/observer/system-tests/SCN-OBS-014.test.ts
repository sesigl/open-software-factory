import { type Forge, type ModelGateway, scenario } from "@opensoftware/testkit";
import {
  FORGEJO_REPOSITORY,
  factoryRepository,
  modelAnswering,
  PROBLEMS,
  PROPOSE,
  propose,
  RESEARCH_FIX,
  RESEARCH_FIX_STEP,
  writeProblems,
} from "./factory.ts";

scenario("SCN-OBS-014", async ({ sut, fakes, given, when, then }) => {
  let forge: Forge;
  await given(FORGEJO_REPOSITORY, async () => {
    forge = await factoryRepository(fakes);
  });
  await given(PROBLEMS, () => writeProblems(sut));

  let gateway: ModelGateway;
  await given(RESEARCH_FIX_STEP, async () => {
    gateway = await modelAnswering(fakes, RESEARCH_FIX);
  });

  await when(PROPOSE, async () => {
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
