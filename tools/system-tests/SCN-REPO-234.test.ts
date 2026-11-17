import { type CliResult, type FakeHttp, scenario } from "@opensoftware/testkit";
import { environment, foreman, github, intake, REPOSITORY, runAt } from "./rehearsal.ts";

scenario("SCN-REPO-234", async ({ sut, fakes, given, when, then }) => {
  const fake = {} as Record<"github" | "intake" | "foreman", FakeHttp>;
  await given('a fake GitHub API of "acme/scratch" that opens the issue 7', async () => {
    fake.github = await github(fakes);
  });
  await given('a fake intake whose work item of the issue 7 has the run "run_1"', async () => {
    fake.intake = await intake(fakes);
  });
  await given(
    'a fake foreman whose run "run_1" failed at the stage "verify" with the reason "the check verify ended with failure"',
    async () => {
      const failed = runAt("verify", "failed", { reason: "the check verify ended with failure" }, "failed");
      fake.foreman = await foreman(fakes, [failed]);
    },
  );

  let run: CliResult;
  await when('the maintainer runs "osf rehearsal run --repository acme/scratch --out rehearsal"', async () => {
    run = await sut.cli(["rehearsal", "run", "--repository", REPOSITORY, "--out", "rehearsal"], {
      env: environment(fake),
    });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the error output is "osf rehearsal: the stage verify failed: the check verify ended with failure"',
    async () => {
      expect(run.stderr).toBe("osf rehearsal: the stage verify failed: the check verify ended with failure\n");
    },
  );

  await then(
    '"rehearsal/summary.md" starts its result with "**Failed:**" and lists the stage "verify" as "failed"',
    async () => {
      const lines = (await sut.files.read("$INPUT/rehearsal/summary.md")).split("\n");
      expect(lines).toContain("**Failed:** the stage verify failed: the check verify ended with failure");
      expect(lines).toContain("| verify | failed | the check verify ended with failure |");
    },
  );
});
