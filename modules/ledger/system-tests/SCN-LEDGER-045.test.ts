import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { githubRoutes } from "./github.ts";

scenario("SCN-LEDGER-045", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  await given("a GitHub API with 101 open pull requests, 100 on the first page and 1 on the second", async () => {
    github = await fakes.http(githubRoutes(Array.from({ length: 101 }, (_, index) => ({ number: 101 - index }))));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "ledger import https://github.com/acme/web"', async () => {
    run = await sut.cli(["import", "https://github.com/acme/web"], { env: { LEDGER_FORGE_URL: github.url } });
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('the output says "wrote 101 events of 101 pull requests to"', async () => {
    expect(run.stdout).toContain("wrote 101 events of 101 pull requests to");
  });
});
