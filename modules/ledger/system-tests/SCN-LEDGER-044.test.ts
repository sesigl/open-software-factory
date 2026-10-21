import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { githubRoutes } from "./github.ts";

scenario("SCN-LEDGER-044", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  await given(
    "a GitHub API whose pull requests, newest update first, are the pull request 3 updated on 2026-01-06 and the pull request 2 updated on 2026-01-04",
    async () => {
      github = await fakes.http(
        githubRoutes([
          { number: 3, created: "2026-01-03T09:00:00Z", updated: "2026-01-06T09:00:00Z" },
          { number: 2, created: "2026-01-02T09:00:00Z", updated: "2026-01-04T09:00:00Z" },
        ]),
      );
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "ledger import --since 2026-01-05 https://github.com/acme/web"', async () => {
    run = await sut.cli(["import", "--since", "2026-01-05", "https://github.com/acme/web"], {
      env: { LEDGER_FORGE_URL: github.url },
    });
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('the output says "wrote 1 event of 1 pull request to"', async () => {
    expect(run.stdout).toContain("wrote 1 event of 1 pull request to");
  });

  await then("the GitHub API received no request for the reviews of the pull request 2", async () => {
    expect(github.requests()).toContain("GET /repos/acme/web/pulls/3/reviews?per_page=100&page=1");
    expect(github.requests().filter((request) => request.includes("/pulls/2/"))).toEqual([]);
  });
});
