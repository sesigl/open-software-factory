import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { commitPull, runRecord, section } from "./pulls.ts";

scenario("SCN-TASK-055", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a run record "run-1.json" of the run "run-1" that names the pull requests "https://github.com/acme/web/pull/7" and "https://github.com/acme/web/pull/8"',
    async () => {
      await sut.files.put(
        "$INPUT/run-1.json",
        runRecord({ id: "run-1", pulls: ["https://github.com/acme/web/pull/7", "https://github.com/acme/web/pull/8"] }),
      );
    },
  );

  let github: FakeHttp;
  await given(
    'a merged GitHub pull request 7 that changes "src/sum.js" from "a - b" to "a + b" and adds "test/sum.test.js"',
    async () => {
      github = await fakes.http([(await commitPull(sut, {})).route]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "taskcapture capture --git . --run run-1.json https://github.com/acme/web/pull/7" with "TASKCAPTURE_FORGE_URL" set to the GitHub API',
    async () => {
      run = await sut.cli(["capture", "--git", ".", "--run", "run-1.json", "https://github.com/acme/web/pull/7"], {
        env: { TASKCAPTURE_FORGE_URL: github.url },
      });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('"suite/web-7/task.toml" has in "[metadata]" the run "run-1"', async () => {
    const metadata = section(await sut.files.read("$OUTPUT/suite/web-7/task.toml"), "metadata");
    expect(metadata).toContain('run_id = "run-1"');
    expect(metadata).toContain('run_harness = "claude-code"');
    expect(metadata.some((line) => line.startsWith("run_model") || line.startsWith("run_cost_usd"))).toBe(false);
  });
});
