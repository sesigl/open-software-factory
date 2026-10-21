import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { capture } from "./pulls.ts";

scenario("SCN-TASK-019", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  await given('a GitHub API that answers 404 to "GET /repos/acme/web/pulls/7"', async () => {
    github = await fakes.http([{ path: "/repos/acme/web/pulls/7", status: 404, body: { message: "Not Found" } }]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture capture --git . https://github.com/acme/web/pull/7" with "TASKCAPTURE_FORGE_URL" set to the GitHub API', async () => {
    run = await capture(sut, github);
  });

  await then('the command exits with code 1', async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the error output says "taskcapture: the forge answered 404 to GET /repos/acme/web/pulls/7"', async () => {
    expect(run.stderr).toBe("taskcapture: the forge answered 404 to GET /repos/acme/web/pulls/7\n");
  });
});
