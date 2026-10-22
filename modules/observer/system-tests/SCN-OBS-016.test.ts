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

scenario("SCN-OBS-016", async ({ sut, fakes, given, when, then }) => {
  let forge: Forge;
  await given(FORGEJO_REPOSITORY, async () => {
    forge = await factoryRepository(fakes);
  });
  await given(PROBLEMS, () => writeProblems(sut));

  let gateway: ModelGateway;
  await given(
    'the model gateway answers a prompt with "Investigated inline." with the solution "Stop running tests twice." and an edit of "AGENTS.md" from "Run tests twice." to "Run tests once."',
    async () => {
      gateway = await modelAnswering(fakes, {
        solution: "Stop running tests twice.",
        edits: [{ path: "AGENTS.md", old: "Run tests twice.", new: "Run tests once." }],
      });
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(PROPOSE, async () => {
    run = await propose(sut, forge, gateway);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the error output says "observer: the edit of AGENTS.md does not apply: the text "Run tests twice." is not in the file"',
    async () => {
      expect(run.stderr).toContain(
        'observer: the edit of AGENTS.md does not apply: the text "Run tests twice." is not in the file',
      );
    },
  );

  await then("the repository has no pull request", async () => {
    expect(await forge.pullRequests("factory")).toEqual([]);
  });
});
