import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { githubRoutes, person, readEvents } from "./github.ts";

scenario("SCN-LEDGER-039", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  await given(
    'a GitHub API with the pull request 1 of "acme/web", merged after 1 approval, and the pull request 2, open with 1 comment by a person',
    async () => {
      github = await fakes.http(
        githubRoutes([
          { number: 2, comments: [{ id: 21, user: person("hubot"), at: "2026-01-06T10:00:00Z" }] },
          {
            number: 1,
            closed: "2026-01-05T12:00:00Z",
            merged: "2026-01-05T12:00:00Z",
            reviews: [{ id: 11, user: person("hubot"), state: "APPROVED", at: "2026-01-05T11:00:00Z" }],
          },
        ]),
      );
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "ledger import https://github.com/acme/web" with "LEDGER_FORGE_URL" set to the GitHub API',
    async () => {
      run = await sut.cli(["import", "https://github.com/acme/web"], { env: { LEDGER_FORGE_URL: github.url } });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output says "wrote 5 events of 2 pull requests to"', async () => {
    expect(run.stdout).toContain("wrote 5 events of 2 pull requests to");
  });

  await then('"pr-events.jsonl" holds 2 "pr.opened@v1", 2 "pr.reviewed@v1" and 1 "pr.closed@v1" events', async () => {
    const types = (await readEvents(sut)).map((event) => event.type);
    expect(types.filter((type) => type === "pr.opened@v1")).toHaveLength(2);
    expect(types.filter((type) => type === "pr.reviewed@v1")).toHaveLength(2);
    expect(types.filter((type) => type === "pr.closed@v1")).toHaveLength(1);
  });
});
