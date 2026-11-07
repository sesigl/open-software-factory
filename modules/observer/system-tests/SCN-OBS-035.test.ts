import { type Forge, scenario } from "@opensoftware/testkit";
import { factoryRepository, modelAnswering, propose, writeProblems } from "./factory.ts";

const SOLUTION = "Tell the triage agent to use the research skill.";
const OLD = "Investigate inline.";
const NEW = "Use the research skill before you investigate.";

scenario("SCN-OBS-035", async ({ sut, fakes, given, when, then }) => {
  let forge: Forge;
  await given('a Forgejo repository "tester/factory" whose "AGENTS.md" says "Investigate inline."', async () => {
    forge = await factoryRepository(fakes);
  });
  await given(
    '"problems.json" with the problem "research-skill-used" of 30 failures in 40 runs, the first of them "run-1" with the reason "Investigated inline." and the transcript "https://langfuse.example/trace/1"',
    () => writeProblems(sut),
  );

  let emptyPath: Awaited<ReturnType<typeof sut.cli>>;
  let numberPath: Awaited<ReturnType<typeof sut.cli>>;
  let noOld: Awaited<ReturnType<typeof sut.cli>>;
  let noNew: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "observer propose --repo <forge URL>/tester/factory problems.json" four times, and the model gateway answers each time with one edit of "AGENTS.md" that has an empty path, the path 7, no "old" or no "new"',
    async () => {
      const answer = async (edit: Record<string, unknown>) =>
        propose(sut, forge, await modelAnswering(fakes, { solution: SOLUTION, edits: [edit] }));
      emptyPath = await answer({ path: "", old: OLD, new: NEW });
      numberPath = await answer({ path: 7, old: OLD, new: NEW });
      noOld = await answer({ path: "AGENTS.md", new: NEW });
      noNew = await answer({ path: "AGENTS.md", old: OLD });
    },
  );

  await then(
    'each run exits with code 1 and the error output says "observer: the model\'s answer is no proposal with "solution" and "edits""',
    async () => {
      const runs = [emptyPath, numberPath, noOld, noNew];
      expect(
        runs.map((run) => run.exitCode),
        runs.map((run) => run.stderr).join(""),
      ).toEqual([1, 1, 1, 1]);
      for (const stderr of runs.map((run) => run.stderr))
        expect(stderr).toContain('observer: the model\'s answer is no proposal with "solution" and "edits"');
    },
  );

  await then("the repository has no pull request", async () => {
    expect(await forge.pullRequests("factory")).toEqual([]);
  });
});
