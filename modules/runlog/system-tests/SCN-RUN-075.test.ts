import { scenario } from "@opensoftware/testkit";
import { runsOf } from "./otlp.ts";
import { claudeLinkSession } from "./sessions.ts";

scenario("SCN-RUN-075", async ({ sut, given, when, then }) => {
  await given(
    'a Git repository with one commit and a Claude Code session whose tool printed "http://forgejo.local/acme/web/pulls/42", "http://forgejo.local/acme/web/issues/9" and "https://github.com/acme/web/pull/108" twice',
    async () => {
      await sut.files.put("$INPUT/session.jsonl", claudeLinkSession());
      await sut.git.commit("init");
    },
  );

  await when('the developer runs "runlog export session.jsonl"', async () => {
    await sut.cli(["export", "session.jsonl"]);
  });

  await then(
    'the root span in "runs.jsonl" has "osf.pull_request.urls" ["http://forgejo.local/acme/web/pulls/42", "https://github.com/acme/web/pull/108"]',
    async () => {
      const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
      expect(exported?.root.attributes["osf.pull_request.urls"]).toEqual([
        "http://forgejo.local/acme/web/pulls/42",
        "https://github.com/acme/web/pull/108",
      ]);
    },
  );

  await then('it has "osf.issue.urls" ["http://forgejo.local/acme/web/issues/9"]', async () => {
    const [exported] = runsOf(await sut.files.read("$OUTPUT/runs.jsonl"));
    expect(exported?.root.attributes["osf.issue.urls"]).toEqual(["http://forgejo.local/acme/web/issues/9"]);
  });
});
