import { scenario } from "@opensoftware/testkit";
import { watchedRepository } from "./given.ts";

scenario("SCN-RUN-082", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and a folder "sessions" with the Claude Code session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d" that ended at "2025-12-31T23:50:45Z"',
    async () => {
      await watchedRepository(sut, "2025-12-31T23:50");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "runlog watch sessions --passes 1"', async () => {
    run = await sut.cli(["watch", "sessions", "--passes", "1"]);
  });

  await then(
    'the output is the one line "exported the run of 5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d to <output folder>/runs.jsonl"',
    async () => {
      expect(run.stderr).toBe("");
      expect(run.stdout).toMatch(/^exported the run of 5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d to \/.+\/runs\.jsonl\n$/);
    },
  );
});
