import { scenario } from "@opensoftware/testkit";
import { aroundMerge } from "./scores.ts";

const URL = "https://forge.example/acme/factory/pulls/12";

scenario("SCN-OBS-038", async ({ sut, fakes, given, when, then }) => {
  await given(
    '"scores.jsonl" where "research-skill-used" failed 30 of 40 runs before "2026-01-10T00:00:00Z" and 2 of 20 runs after it',
    async () => {
      await sut.files.put("$INPUT/scores.jsonl", aroundMerge(30, 40, 2, 20));
    },
  );

  let forge: Awaited<ReturnType<typeof fakes.http>>;
  await given(
    'a forge API that answers the pull request 12 of "acme/factory" as merged at "2026-01-10T00:00:00Z"',
    async () => {
      forge = await fakes.http([
        { path: "/repos/acme/factory/pulls/12", body: { number: 12, merged: true, merged_at: "2026-01-10T00:00:00Z" } },
      ]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "observer check --problem research-skill-used --pull-request https://forge.example/acme/factory/pulls/12 scores.jsonl" with "OBSERVER_FORGE_URL" "<forge API URL>//"',
    async () => {
      run = await sut.cli(["check", "--problem", "research-skill-used", "--pull-request", URL, "scores.jsonl"], {
        env: { OBSERVER_FORGE_URL: `${forge.url}//` },
      });
    },
  );

  await then(
    'the output says "research-skill-used: 75.0% before (30 of 40 runs), 10.0% after (2 of 20 runs): fell"',
    async () => {
      expect(run.exitCode, run.stderr).toBe(0);
      expect(run.stdout).toContain(
        "research-skill-used: 75.0% before (30 of 40 runs), 10.0% after (2 of 20 runs): fell",
      );
    },
  );

  await then('the forge API got only "GET /repos/acme/factory/pulls/12"', async () => {
    expect(forge.requests()).toEqual(["GET /repos/acme/factory/pulls/12"]);
  });
});
