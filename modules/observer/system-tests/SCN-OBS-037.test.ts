import { scenario } from "@opensoftware/testkit";
import { aroundMerge } from "./scores.ts";

const URLS = [
  "not a URL",
  "https://github.com/acme/factory/pull/12x",
  "https://github.com/acme/factory/pull/x12",
  "https://github.com/acme/factory/xpull/12",
  "https://github.com/acme/factory/pullz/12",
];

scenario("SCN-OBS-037", async ({ sut, given, when, then }) => {
  await given(
    '"scores.jsonl" where "research-skill-used" failed 30 of 40 runs before "2026-01-10T00:00:00Z" and 2 of 20 runs after it',
    async () => {
      await sut.files.put("$INPUT/scores.jsonl", aroundMerge(30, 40, 2, 20));
    },
  );

  let runs: Awaited<ReturnType<typeof sut.cli>>[] = [];
  await when(
    'the user runs "observer check --problem research-skill-used --pull-request <URL> scores.jsonl" with the URLs "not a URL", ".../pull/12x", ".../pull/x12", ".../xpull/12" and ".../pullz/12" of "https://github.com/acme/factory"',
    async () => {
      runs = await Promise.all(
        URLS.map((url) =>
          sut.cli(["check", "--problem", "research-skill-used", "--pull-request", url, "scores.jsonl"]),
        ),
      );
    },
  );

  await then(
    'each run exits with code 2; the error output says "observer: not a URL is not a URL like https://github.com/acme/factory/pull/12" and, for the others, "observer: <URL> is not a pull request URL like https://github.com/acme/factory/pull/12"',
    async () => {
      expect(
        runs.map((run) => run.exitCode),
        runs.map((run) => run.stderr).join(""),
      ).toEqual([2, 2, 2, 2, 2]);
      expect(runs.map((run) => run.stderr)).toEqual([
        "observer: not a URL is not a URL like https://github.com/acme/factory/pull/12\n",
        ...URLS.slice(1).map(
          (url) => `observer: ${url} is not a pull request URL like https://github.com/acme/factory/pull/12\n`,
        ),
      ]);
    },
  );
});
