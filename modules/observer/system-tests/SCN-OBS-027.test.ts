import { scenario } from "@opensoftware/testkit";
import { aroundMerge } from "./scores.ts";

const LINE = "research-skill-used: 75.0% before (30 of 40 runs), 10.0% after (2 of 20 runs): fell";

scenario("SCN-OBS-027", async ({ sut, fakes, given, when, then }) => {
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
        { method: "POST", path: "/repos/acme/factory/issues/12/comments", status: 201, body: { id: 1 } },
      ]);
    },
  );

  await when(
    'the user runs "observer check --problem research-skill-used --pull-request https://github.com/acme/factory/pull/12 --comment scores.jsonl" with "OBSERVER_FORGE_TOKEN" "forge-token"',
    async () => {
      const run = await sut.cli(
        [
          "check",
          "--problem",
          "research-skill-used",
          "--pull-request",
          "https://github.com/acme/factory/pull/12",
          "--comment",
          "scores.jsonl",
        ],
        { env: { OBSERVER_FORGE_URL: forge.url, OBSERVER_FORGE_TOKEN: "forge-token" } },
      );
      expect(run.exitCode, run.stderr).toBe(0);
    },
  );

  await then(
    'the forge got a comment on the pull request 12 that says "research-skill-used: 75.0% before (30 of 40 runs), 10.0% after (2 of 20 runs): fell"',
    async () => {
      expect(forge.received()).toContainEqual({
        method: "POST",
        path: "/repos/acme/factory/issues/12/comments",
        body: { body: LINE },
      });
    },
  );

  await then('the comment was sent with the header "authorization: token forge-token"', async () => {
    const sent = forge.headers().find((request) => request.method === "POST");
    expect(sent?.headers.authorization).toBe("token forge-token");
  });
});
