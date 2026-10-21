import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { githubRoutes, person } from "./github.ts";
import { readReport } from "./records.ts";

scenario("SCN-LEDGER-040", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  await given(
    "a GitHub API with a pull request opened at 09:00, approved by a person at 11:00 and merged at 12:00",
    async () => {
      github = await fakes.http(
        githubRoutes([
          {
            number: 1,
            created: "2026-01-05T09:00:00Z",
            closed: "2026-01-05T12:00:00Z",
            merged: "2026-01-05T12:00:00Z",
            reviews: [{ id: 11, user: person("hubot"), state: "APPROVED", at: "2026-01-05T11:00:00Z" }],
          },
        ]),
      );
    },
  );

  await when(
    'the user runs "ledger import --out pr-events.jsonl https://github.com/acme/web" and then "ledger report pr-events.jsonl"',
    async () => {
      const env = { LEDGER_FORGE_URL: github.url };
      const imported = await sut.cli(["import", "--out", "pr-events.jsonl", "https://github.com/acme/web"], { env });
      expect(imported.exitCode, imported.stderr).toBe(0);
      const reported = await sut.cli(["report", "pr-events.jsonl"]);
      expect(reported.exitCode, reported.stderr).toBe(0);
    },
  );

  await then('"report.json" shows 1 pull request opened and 1 merged', async () => {
    const { pullRequests } = await readReport(sut);
    expect(pullRequests.opened).toBe(1);
    expect(pullRequests.merged).toBe(1);
  });

  await then(
    '"report.json" shows the median hours from pull request to first human review 2 and from first human review to merge 1',
    async () => {
      const { cycleTime } = await readReport(sut);
      expect(cycleTime.pullRequestToFirstHumanReview).toBe(2);
      expect(cycleTime.firstHumanReviewToMerge).toBe(1);
    },
  );
});
