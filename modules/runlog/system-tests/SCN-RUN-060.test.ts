import { scenario } from "@opensoftware/testkit";
import { readmeSession } from "./sessions.ts";

scenario("SCN-RUN-060", async ({ sut, fakes, given, when, then }) => {
  await given("a Git repository with one commit and the sample Claude Code session from the README", async () => {
    const readme = fakes.fromRepository("modules/runlog")["README.md"] as string;
    await sut.files.put("$INPUT/session.jsonl", readmeSession(readme));
    await sut.git.commit("init");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "runlog export session.jsonl"', async () => {
    run = await sut.cli(["export", "session.jsonl"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the standard output is "exported the run of 0f6c1d2e-3a4b-4c5d-8e9f-a0b1c2d3e4f5 to $OUTPUT/runs.jsonl"',
    async () => {
      const target = sut.files.path("$OUTPUT/runs.jsonl");
      expect(run.stdout).toBe(`exported the run of 0f6c1d2e-3a4b-4c5d-8e9f-a0b1c2d3e4f5 to ${target}\n`);
    },
  );
});
