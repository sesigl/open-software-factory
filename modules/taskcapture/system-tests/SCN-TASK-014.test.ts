import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { capture, commitPull } from "./pulls.ts";

scenario("SCN-TASK-014", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  let pull: Awaited<ReturnType<typeof commitPull>>;
  await given('a GitHub pull request 7 of "acme/web" that is still open', async () => {
    pull = await commitPull(sut, { merged: false });
    github = await fakes.http([pull.route]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture capture --git . https://github.com/acme/web/pull/7" with "TASKCAPTURE_FORGE_URL" set to the GitHub API', async () => {
    run = await capture(sut, github);
  });

  await then('the command exits with code 1', async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the error output says "taskcapture: the pull request https://github.com/acme/web/pull/7 is not merged"', async () => {
    expect(run.stderr).toBe("taskcapture: the pull request https://github.com/acme/web/pull/7 is not merged\n");
  });

  await then('the output folder is empty', async () => {
    expect(await sut.files.list("$OUTPUT")).toEqual([]);
  });
});
