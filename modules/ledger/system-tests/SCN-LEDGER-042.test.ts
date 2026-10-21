import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { githubRoutes, person, readEvents } from "./github.ts";

scenario("SCN-LEDGER-042", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  await given('a GitHub API with a pull request by "mona" that "mona" commented on and "hubot" approved', async () => {
    github = await fakes.http(
      githubRoutes([
        {
          number: 1,
          user: person("mona"),
          comments: [{ id: 12, user: person("mona"), at: "2026-01-05T09:30:00Z" }],
          reviews: [
            { id: 13, user: person("mona"), state: "COMMENTED", at: "2026-01-05T09:40:00Z" },
            { id: 14, user: person("hubot"), state: "APPROVED", at: "2026-01-05T11:00:00Z" },
          ],
        },
      ]),
    );
  });

  await when('the user runs "ledger import https://github.com/acme/web"', async () => {
    const run = await sut.cli(["import", "https://github.com/acme/web"], { env: { LEDGER_FORGE_URL: github.url } });
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('"pr-events.jsonl" has 1 "pr.reviewed@v1" event, by "github:hubot"', async () => {
    const reviews = (await readEvents(sut)).filter((event) => event.type === "pr.reviewed@v1");
    expect(reviews.map((event) => event.data.reviewer.id)).toEqual(["github:hubot"]);
    expect(reviews[0].data).toMatchObject({ automated: false, state: "approved" });
  });
});
