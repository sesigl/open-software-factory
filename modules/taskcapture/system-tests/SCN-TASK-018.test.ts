import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { capture, commitPull } from "./pulls.ts";

scenario("SCN-TASK-018", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  let pull: Awaited<ReturnType<typeof commitPull>>;
  await given(
    'a merged GitHub pull request 7 that changes "src/sum.js" from "a - b" to "a + b" and adds "test/sum.test.js"',
    async () => {
      pull = await commitPull(sut, {});
      github = await fakes.http([pull.route]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "taskcapture capture --git . https://github.com/acme/web/pull/7" with "TASKCAPTURE_FORGE_TOKEN" set to "secret-token"',
    async () => {
      run = await capture(sut, github, [], { TASKCAPTURE_FORGE_TOKEN: "secret-token" });
    },
  );

  await then('every request the GitHub API received has the header "authorization" "token secret-token"', async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    const requests = github.headers();
    expect(requests.length).toBeGreaterThan(0);
    for (const request of requests) expect(request.headers.authorization).toBe("token secret-token");
  });

  await then('no file in the output folder contains "secret-token"', async () => {
    const files = await sut.files.list("$OUTPUT");
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect(await sut.files.read(`$OUTPUT/${file}`)).not.toContain("secret-token");
  });
});
