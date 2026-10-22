import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { commitPull } from "./pulls.ts";

scenario("SCN-TASK-037", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  await given(
    'a GitHub API that knows the merged pull request 7 of "acme/web" on a host "http://127.0.0.1:9" that answers no Git request',
    async () => {
      github = await fakes.http([(await commitPull(sut, {})).route]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "taskcapture capture http://127.0.0.1:9/acme/web/pull/7" with the GitHub API and "TASKCAPTURE_FORGE_TOKEN" set to "secret-token"',
    async () => {
      run = await sut.cli(["capture", "http://127.0.0.1:9/acme/web/pull/7"], {
        env: { TASKCAPTURE_FORGE_URL: github.url, TASKCAPTURE_FORGE_TOKEN: "secret-token" },
      });
    },
  );

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the error output starts with "taskcapture: could not clone http://127.0.0.1:9/acme/web.git"',
    async () => {
      expect(
        run.stderr.startsWith("taskcapture: could not clone http://127.0.0.1:9/acme/web.git: git clone failed: "),
      ).toBe(true);
    },
  );

  await then('the error output does not contain "secret-token"', async () => {
    expect(run.stderr).not.toContain("secret-token");
  });
});
