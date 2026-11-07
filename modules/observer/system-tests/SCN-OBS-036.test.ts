import { type Forge, type ModelGateway, scenario } from "@opensoftware/testkit";
import { factoryRepository, modelAnswering, propose, writeProblems } from "./factory.ts";

scenario("SCN-OBS-036", async ({ sut, fakes, given, when, then }) => {
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
    'the model gateway answers a prompt with "Investigated inline." with the solution "Keep notes outside." and a new file "../notes.md"',
    async () => {
      gateway = await modelAnswering(fakes, {
        solution: "Keep notes outside.",
        edits: [{ path: "../notes.md", old: "", new: "Notes\n" }],
      });
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "observer propose --repo <forge URL>/tester/factory problems.json"', async () => {
    run = await propose(sut, forge, gateway);
  });

  await then(
    'the command exits with code 1 and the error output says "observer: the edit of ../notes.md does not apply: the path leaves the repository"',
    async () => {
      expect(run.exitCode, run.stderr).toBe(1);
      expect(run.stderr).toContain("observer: the edit of ../notes.md does not apply: the path leaves the repository");
    },
  );

  await then("the repository has no pull request", async () => {
    expect(await forge.pullRequests("factory")).toEqual([]);
  });
});
