import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { capture, commitPull } from "./pulls.ts";

scenario("SCN-TASK-015", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  let pull: Awaited<ReturnType<typeof commitPull>>;
  await given('a merged GitHub pull request 7 that changes only "src/sum.js"', async () => {
    pull = await commitPull(sut, { change: { "src/sum.js": "export const sum = (a, b) => a + b;\n" } });
    github = await fakes.http([pull.route]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture capture --git . https://github.com/acme/web/pull/7" with "TASKCAPTURE_FORGE_URL" set to the GitHub API', async () => {
    run = await capture(sut, github);
  });

  await then('the command exits with code 1', async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the error output says "taskcapture: the pull request changes no test file, so a task could not score it (see --tests)"', async () => {
    expect(run.stderr).toBe("taskcapture: the pull request changes no test file, so a task could not score it (see --tests)\n");
  });

  await then('the output folder is empty', async () => {
    expect(await sut.files.list("$OUTPUT")).toEqual([]);
  });
});
