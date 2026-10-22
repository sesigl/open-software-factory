import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { commitPull } from "./pulls.ts";

scenario("SCN-TASK-041", async ({ sut, fakes, given, when, then }) => {
  let host: FakeHttp;
  let url: string;
  await given(
    'a merged pull request 7 of "acme/web" on a GitHub Enterprise host whose API answers only below "/api/v3"',
    async () => {
      const { route } = await commitPull(sut, {});
      host = await fakes.http([{ ...route, path: `/api/v3${route.path}` }]);
      url = `${host.url}/acme/web/pull/7`;
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "taskcapture capture --git . --forge github <host>/acme/web/pull/7" without "TASKCAPTURE_FORGE_URL"',
    async () => {
      run = await sut.cli(["capture", "--git", ".", "--forge", "github", url]);
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('"suite/web-7/task.toml" names the source "<host>/acme/web/pull/7"', async () => {
    expect(await sut.files.read("$OUTPUT/suite/web-7/task.toml")).toContain(`source = "${url}"`);
  });
});
