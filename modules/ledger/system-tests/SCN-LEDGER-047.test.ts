import { type FakeHttp, scenario } from "@opensoftware/testkit";

scenario("SCN-LEDGER-047", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  await given('a GitHub API that answers 401 to "GET /repos/acme/web/pulls"', async () => {
    github = await fakes.http([
      {
        path: "/repos/acme/web/pulls?state=all&sort=updated&direction=desc&per_page=100&page=1",
        status: 401,
        body: { message: "Bad credentials" },
      },
    ]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "ledger import https://github.com/acme/web" with "LEDGER_FORGE_TOKEN" set to "secret-token"',
    async () => {
      run = await sut.cli(["import", "https://github.com/acme/web"], {
        env: { LEDGER_FORGE_URL: github.url, LEDGER_FORGE_TOKEN: "secret-token" },
      });
    },
  );

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the error output says "ledger: the forge answered 401 to GET /repos/acme/web/pulls"', async () => {
    expect(run.stderr).toContain("ledger: the forge answered 401 to GET /repos/acme/web/pulls");
  });

  await then('the output and the error output do not contain "secret-token"', async () => {
    expect(run.stdout + run.stderr).not.toContain("secret-token");
  });

  await then('the output folder has no file "pr-events.jsonl"', async () => {
    expect(await sut.files.list("$OUTPUT")).not.toContain("pr-events.jsonl");
  });
});
