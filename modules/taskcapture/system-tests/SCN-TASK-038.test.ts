import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { capture, commitPull } from "./pulls.ts";

const UNKNOWN = "0123456789abcdef0123456789abcdef01234567";

scenario("SCN-TASK-038", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  await given(
    'a GitHub API that says pull request 7 was merged as a commit the Git repository in "--git" does not have',
    async () => {
      const { route } = await commitPull(sut, {});
      github = await fakes.http([{ ...route, body: { ...(route.body as object), merge_commit_sha: UNKNOWN } }]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "taskcapture capture --git . https://github.com/acme/web/pull/7" with "TASKCAPTURE_FORGE_URL" set to the GitHub API',
    async () => {
      run = await capture(sut, github);
    },
  );

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then("the error output says the commit or its parent is not in the repository", async () => {
    expect(run.stderr).toBe(`taskcapture: the commit ${UNKNOWN} or its parent is not in the repository at .\n`);
  });
});
