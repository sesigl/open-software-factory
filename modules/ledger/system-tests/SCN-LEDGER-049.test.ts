import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { githubRoutes } from "./github.ts";

scenario("SCN-LEDGER-049", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  await given('a GitHub API with 1 open pull request of "acme/web"', async () => {
    github = await fakes.http(githubRoutes([{ number: 1 }]));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "ledger import --forge github https://github.acme.internal/acme/web" with "LEDGER_FORGE_URL" set to the GitHub API',
    async () => {
      run = await sut.cli(["import", "--forge", "github", "https://github.acme.internal/acme/web"], {
        env: { LEDGER_FORGE_URL: github.url },
      });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output says "wrote 1 event of 1 pull request to"', async () => {
    expect(run.stdout).toContain("wrote 1 event of 1 pull request to");
  });
});
