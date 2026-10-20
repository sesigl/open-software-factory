import { scenario } from "@opensoftware/testkit";
import { claudeRepository } from "./given.ts";
import { runsOf } from "./otlp.ts";

scenario("SCN-RUN-012", async ({ sut, given, when, then }) => {
  let commit = "";
  await given(
    'a Git repository with one commit and the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"',
    async () => {
      commit = await claudeRepository(sut);
    },
  );

  await when('the developer runs "runlog export session.jsonl"', async () => {
    await sut.cli(["export", "session.jsonl"]);
  });

  await then(
    'the resource in "runs.jsonl" has "osf.run.id" "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d", "osf.requester.id" "git:test@example.invalid" and "osf.source" "cli"',
    async () => {
      const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
      expect(exported?.resource).toMatchObject({
        "osf.run.id": "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d",
        "osf.requester.kind": "person",
        "osf.requester.id": "git:test@example.invalid",
        "osf.source": "cli",
      });
    },
  );

  await then('the resource has "osf.factory.version" set to the commit of the repository', async () => {
    const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
    expect(exported?.resource["osf.factory.version"]).toBe(commit);
  });
});
