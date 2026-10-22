import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { commitPull, runRecord, section } from "./pulls.ts";

scenario("SCN-TASK-053", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a run record "run-1.json" of the run "run-1" by "claude-code" with the model "claude-sonnet-5-5" for 2.4 USD that names the pull request "https://github.com/acme/web/pull/7"',
    async () => {
      await sut.files.put(
        "$INPUT/run-1.json",
        runRecord({
          id: "run-1",
          harness: "claude-code",
          model: "claude-sonnet-5-5",
          costUsd: 2.4,
          pulls: ["https://github.com/acme/web/pull/7"],
        }),
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
    'the user runs "taskcapture capture --git . --run run-1.json" with "TASKCAPTURE_FORGE_URL" set to the GitHub API',
    async () => {
      run = await sut.cli(["capture", "--git", ".", "--run", "run-1.json"], {
        env: { TASKCAPTURE_FORGE_URL: github.url },
      });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('the output says "wrote the task web-7 to"', async () => {
    expect(run.stdout).toContain("wrote the task web-7 to");
  });

  await then(
    '"suite/web-7/task.toml" has in "[metadata]" the run "run-1", the harness "claude-code", the model "claude-sonnet-5-5" and the cost 2.4',
    async () => {
      const metadata = section(await sut.files.read("$OUTPUT/suite/web-7/task.toml"), "metadata");
      expect(metadata).toContain('source = "https://github.com/acme/web/pull/7"');
      expect(metadata).toContain('run_id = "run-1"');
      expect(metadata).toContain('run_harness = "claude-code"');
      expect(metadata).toContain('run_model = "claude-sonnet-5-5"');
      expect(metadata).toContain("run_cost_usd = 2.4");
    },
  );
});
