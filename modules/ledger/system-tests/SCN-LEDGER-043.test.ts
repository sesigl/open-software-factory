import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { githubRoutes, readEvents } from "./github.ts";

scenario("SCN-LEDGER-043", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  await given("a GitHub API with a pull request closed at 15:00 without a merge", async () => {
    github = await fakes.http(githubRoutes([{ number: 1, closed: "2026-01-05T15:00:00Z" }]));
  });

  await when('the user runs "ledger import https://github.com/acme/web"', async () => {
    const run = await sut.cli(["import", "https://github.com/acme/web"], { env: { LEDGER_FORGE_URL: github.url } });
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('"pr-events.jsonl" has a "pr.closed@v1" event at "2026-01-05T15:00:00Z" with "merged" false', async () => {
    const closes = (await readEvents(sut)).filter((event) => event.type === "pr.closed@v1");
    expect(closes).toHaveLength(1);
    expect(closes[0].time).toBe("2026-01-05T15:00:00Z");
    expect(closes[0].data).toEqual({ url: "https://github.com/acme/web/pull/1", merged: false });
  });
});
