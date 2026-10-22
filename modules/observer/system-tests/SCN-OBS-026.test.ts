import { scenario } from "@opensoftware/testkit";
import { aroundMerge } from "./scores.ts";

scenario("SCN-OBS-026", async ({ sut, fakes, given, when, then }) => {
  await given(
    '"scores.jsonl" where "research-skill-used" failed 30 of 40 runs before "2026-01-10T00:00:00Z" and 2 of 20 runs after it',
    async () => {
      await sut.files.put("$INPUT/scores.jsonl", aroundMerge(30, 40, 2, 20));
    },
  );

  let forge: Awaited<ReturnType<typeof fakes.http>>;
  await given('a forge API that answers the pull request 12 of "acme/factory" as open', async () => {
    forge = await fakes.http([
      { path: "/repos/acme/factory/pulls/12", body: { number: 12, state: "open", merged: false, merged_at: null } },
    ]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "observer check --problem research-skill-used --pull-request https://github.com/acme/factory/pull/12 scores.jsonl"',
    async () => {
      run = await sut.cli(
        [
          "check",
          "--problem",
          "research-skill-used",
          "--pull-request",
          "https://github.com/acme/factory/pull/12",
          "scores.jsonl",
        ],
        { env: { OBSERVER_FORGE_URL: forge.url } },
      );
    },
  );

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the error output says "observer: the pull request https://github.com/acme/factory/pull/12 is not merged"',
    async () => {
      expect(run.stderr).toContain("observer: the pull request https://github.com/acme/factory/pull/12 is not merged");
      expect(await sut.files.list("$OUTPUT")).toEqual([]);
    },
  );
});
