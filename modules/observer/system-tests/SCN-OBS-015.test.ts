import { type Forge, type ModelGateway, scenario } from "@opensoftware/testkit";
import {
  FORGEJO_REPOSITORY,
  factoryRepository,
  modelAnswering,
  PROBLEMS,
  PROPOSE,
  propose,
  writeProblems,
} from "./factory.ts";

const WORKFLOW = "name: research\non: pull_request\n";

scenario("SCN-OBS-015", async ({ sut, fakes, given, when, then }) => {
  let forge: Forge;
  await given(FORGEJO_REPOSITORY, async () => {
    forge = await factoryRepository(fakes);
  });
  await given(PROBLEMS, () => writeProblems(sut));

  let gateway: ModelGateway;
  await given(
    'the model gateway answers a prompt with "Investigated inline." with the solution "Run the research check in CI." and a new file ".github/workflows/research.yml"',
    async () => {
      gateway = await modelAnswering(fakes, {
        solution: "Run the research check in CI.",
        edits: [{ path: ".github/workflows/research.yml", old: "", new: WORKFLOW }],
      });
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(PROPOSE, async () => {
    run = await propose(sut, forge, gateway);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the pull request\'s title starts with "[needs human] observer: research-skill-used"', async () => {
    const [pr] = await forge.pullRequests("factory");
    expect(pr?.title).toBe("[needs human] observer: research-skill-used failed 30 of 40 runs");
    expect(await forge.file("factory", ".github/workflows/research.yml", pr?.head as string)).toBe(WORKFLOW);
  });

  await then(
    'its description says "needs human: the change touches the protected path .github/workflows/research.yml"',
    async () => {
      const [pr] = await forge.pullRequests("factory");
      expect(pr?.body).toContain("needs human: the change touches the protected path .github/workflows/research.yml");
    },
  );
});
