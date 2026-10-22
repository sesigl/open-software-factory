import { scenario } from "@opensoftware/testkit";
import { aroundMerge } from "./scores.ts";

const URL = "https://github.com/acme/factory/issues/12";

scenario("SCN-OBS-032", async ({ sut, given, when, then }) => {
  await given(
    '"scores.jsonl" where "research-skill-used" failed 30 of 40 runs before "2026-01-10T00:00:00Z" and 2 of 20 runs after it',
    async () => {
      await sut.files.put("$INPUT/scores.jsonl", aroundMerge(30, 40, 2, 20));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "observer check --problem research-skill-used --pull-request https://github.com/acme/factory/issues/12 scores.jsonl"',
    async () => {
      run = await sut.cli(["check", "--problem", "research-skill-used", "--pull-request", URL, "scores.jsonl"]);
    },
  );

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then(
    'the error output says "observer: https://github.com/acme/factory/issues/12 is not a pull request URL like https://github.com/acme/factory/pull/12"',
    async () => {
      expect(run.stderr).toContain(
        `observer: ${URL} is not a pull request URL like https://github.com/acme/factory/pull/12`,
      );
    },
  );
});
