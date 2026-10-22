import { scenario } from "@opensoftware/testkit";
import { runRecord } from "./pulls.ts";

scenario("SCN-TASK-056", async ({ sut, given, when, then }) => {
  await given(
    'a run record "run-1.json" of the run "run-1" that names the pull requests "https://github.com/acme/web/pull/7" and "https://github.com/acme/web/pull/8"',
    async () => {
      await sut.files.put(
        "$INPUT/run-1.json",
        runRecord({ id: "run-1", pulls: ["https://github.com/acme/web/pull/7", "https://github.com/acme/web/pull/8"] }),
      );
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "taskcapture capture --git . --run run-1.json https://github.com/acme/web/pull/9"',
    async () => {
      run = await sut.cli(["capture", "--git", ".", "--run", "run-1.json", "https://github.com/acme/web/pull/9"]);
    },
  );

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then(
    'the error output says "taskcapture: the run run-1 names no pull request https://github.com/acme/web/pull/9"',
    async () => {
      expect(run.stderr).toContain(
        "taskcapture: the run run-1 names no pull request https://github.com/acme/web/pull/9",
      );
    },
  );
});
