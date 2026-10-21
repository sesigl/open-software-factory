import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { githubRoutes } from "./github.ts";

scenario("SCN-LEDGER-046", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  await given("a GitHub API with 1 open pull request", async () => {
    github = await fakes.http(githubRoutes([{ number: 1 }]));
  });

  await when(
    'the user runs "ledger import https://github.com/acme/web" with "LEDGER_FORGE_TOKEN" set to "test-token"',
    async () => {
      const run = await sut.cli(["import", "https://github.com/acme/web"], {
        env: { LEDGER_FORGE_URL: github.url, LEDGER_FORGE_TOKEN: "test-token" },
      });
      expect(run.exitCode, run.stderr).toBe(0);
    },
  );

  await then('every request the GitHub API received has the header "authorization" "token test-token"', async () => {
    const requests = github.headers();
    expect(requests).toHaveLength(3);
    for (const request of requests) expect(request.headers.authorization, request.path).toBe("token test-token");
  });
});
