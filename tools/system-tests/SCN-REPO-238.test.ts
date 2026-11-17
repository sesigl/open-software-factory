import { type CliResult, type FakeHttp, scenario } from "@opensoftware/testkit";
import { AT_GATE, environment, foreman, github, intake, REPOSITORY } from "./rehearsal.ts";

scenario("SCN-REPO-238", async ({ sut, fakes, given, when, then }) => {
  const fake = {} as Record<"github" | "intake" | "foreman", FakeHttp>;
  await given('a fake GitHub API of "acme/scratch" that opens the issue 7', async () => {
    fake.github = await github(fakes);
  });
  await given('a fake intake whose work item of the issue 7 has the run "run_1"', async () => {
    fake.intake = await intake(fakes);
  });
  await given(
    'a fake foreman whose run "run_1" waits at the gate of the stage "implement" with the pull request 8',
    async () => {
      fake.foreman = await foreman(fakes, [AT_GATE]);
    },
  );

  let run: CliResult;
  await when(
    'the maintainer runs "osf rehearsal run --repository acme/scratch --out rehearsal" with "REHEARSAL_WAIT_MS=300"',
    async () => {
      run = await sut.cli(["rehearsal", "run", "--repository", REPOSITORY, "--out", "rehearsal"], {
        env: { ...environment(fake), REHEARSAL_WAIT_MS: "300" },
      });
    },
  );

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the error output is "osf rehearsal: the stage implement did not end within 300 ms: it is blocked at its gate"',
    async () => {
      expect(run.stderr).toBe(
        "osf rehearsal: the stage implement did not end within 300 ms: it is blocked at its gate\n",
      );
    },
  );
});
