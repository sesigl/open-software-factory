import { type Forge, type ModelGateway, scenario } from "@opensoftware/testkit";
import { FORGEJO_REPOSITORY, factoryRepository, PROBLEMS, PROPOSE, propose, writeProblems } from "./factory.ts";

scenario("SCN-OBS-029", async ({ sut, fakes, given, when, then }) => {
  let forge: Forge;
  await given(FORGEJO_REPOSITORY, async () => {
    forge = await factoryRepository(fakes);
  });
  await given(PROBLEMS, () => writeProblems(sut));

  let gateway: ModelGateway;
  await given(
    'the model gateway answers a prompt with "Investigated inline." with the text "Tell the agent to use the research skill."',
    async () => {
      gateway = await fakes.modelGateway([
        { when: "Investigated inline.", reply: "Tell the agent to use the research skill." },
      ]);
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
    'the error output says "observer: the model\'s answer is no proposal with "solution" and "edits": Tell the agent to use the research skill."',
    async () => {
      expect(run.stderr).toContain(
        'observer: the model\'s answer is no proposal with "solution" and "edits": Tell the agent to use the research skill.',
      );
    },
  );

  await then("the repository has no pull request", async () => {
    expect(await forge.pullRequests("factory")).toEqual([]);
  });
});
