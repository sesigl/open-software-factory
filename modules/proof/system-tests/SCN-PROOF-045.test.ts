import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { PULL_REQUEST_EVENT, putJunit } from "./action.ts";
import { githubRoutes } from "./forge.ts";

scenario("SCN-PROOF-045", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  await given('a GitHub API without comments on the pull request "https://github.com/acme/web/pull/7"', async () => {
    github = await fakes.http(githubRoutes([]));
  });

  await given('a JUnit report "reports/web.xml" where "SCN-WEB-001" passed', async () => {
    await putJunit(sut, ["SCN-WEB-001"]);
  });

  let run: Awaited<ReturnType<typeof sut.action>>;
  await when(
    'a pull request workflow of "acme/web" runs the action with "junit: reports/*.xml" and "scenarios: SCN-WEB-001 SCN-WEB-003"',
    async () => {
      run = await sut.action(
        { junit: "reports/*.xml", scenarios: "SCN-WEB-001 SCN-WEB-003" },
        { event: PULL_REQUEST_EVENT, repository: "acme/web", env: { PROOF_FORGE_URL: github.url } },
      );
    },
  );

  await then("the action fails", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "SCN-WEB-003 has no evidence"', async () => {
    expect(run.stdout + run.stderr).toContain("SCN-WEB-003 has no evidence");
  });
});
