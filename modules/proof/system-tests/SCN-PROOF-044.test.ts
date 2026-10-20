import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { PULL_REQUEST_EVENT, putJunit } from "./action.ts";
import { githubRoutes } from "./forge.ts";
import { SHA } from "./reports.ts";

scenario("SCN-PROOF-044", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  await given('a GitHub API without comments on the pull request "https://github.com/acme/web/pull/7"', async () => {
    github = await fakes.http(githubRoutes([]));
  });

  await given('a JUnit report "reports/web.xml" where "SCN-WEB-001" passed and "SCN-WEB-002" failed', async () => {
    await putJunit(sut, ["SCN-WEB-001"], ["SCN-WEB-002"]);
  });

  let run: Awaited<ReturnType<typeof sut.action>>;
  await when('a pull request workflow of "acme/web" runs the action with "junit: reports/*.xml"', async () => {
    run = await sut.action(
      { junit: "reports/*.xml" },
      { event: PULL_REQUEST_EVENT, repository: "acme/web", env: { PROOF_FORGE_URL: github.url } },
    );
  });

  await then("the action fails", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "SCN-WEB-002 failed"', async () => {
    expect(run.stdout + run.stderr).toContain("SCN-WEB-002 failed");
  });

  await then(
    'the GitHub API received "POST /repos/acme/web/statuses/9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c" with the context "proof" and the state "failure"',
    async () => {
      const status = github.received().find((request) => request.path === `/repos/acme/web/statuses/${SHA}`);
      expect(status?.body).toMatchObject({ context: "proof", state: "failure" });
    },
  );
});
