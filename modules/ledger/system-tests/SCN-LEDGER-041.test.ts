import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { githubRoutes, readEvents } from "./github.ts";

scenario("SCN-LEDGER-041", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  await given('a GitHub API with a pull request reviewed by the user "renovate[bot]" of type "Bot"', async () => {
    github = await fakes.http(
      githubRoutes([
        {
          number: 1,
          reviews: [
            { id: 11, user: { login: "renovate[bot]", type: "Bot" }, state: "COMMENTED", at: "2026-01-05T10:00:00Z" },
          ],
        },
      ]),
    );
  });

  await when('the user runs "ledger import https://github.com/acme/web"', async () => {
    const run = await sut.cli(["import", "https://github.com/acme/web"], { env: { LEDGER_FORGE_URL: github.url } });
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then(
    '"pr-events.jsonl" has a "pr.reviewed@v1" event with "automated" true by the trigger "github:renovate[bot]"',
    async () => {
      const reviews = (await readEvents(sut)).filter((event) => event.type === "pr.reviewed@v1");
      expect(reviews).toHaveLength(1);
      expect(reviews[0].data).toMatchObject({
        automated: true,
        reviewer: { kind: "trigger", id: "github:renovate[bot]" },
        state: "commented",
      });
    },
  );
});
