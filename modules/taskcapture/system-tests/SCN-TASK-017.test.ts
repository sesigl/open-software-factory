import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { capture, commitPull } from "./pulls.ts";

scenario("SCN-TASK-017", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  let pull: Awaited<ReturnType<typeof commitPull>>;
  await given(
    'a merged GitHub pull request 7 that changes "src/sum.js" from "a - b" to "a + b" and adds "test/sum.test.js"',
    async () => {
      pull = await commitPull(sut, {});
      github = await fakes.http([pull.route]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "taskcapture capture --git . https://github.com/acme/web/pull/7" with "TASKCAPTURE_FORGE_URL" set to the GitHub API',
    async () => {
      run = await capture(sut, github);
    },
  );

  await then('"suite/web-7/task.toml" has the schema version "1.4"', async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    expect((await sut.files.read("$OUTPUT/suite/web-7/task.toml")).split("\n")[0]).toBe('schema_version = "1.4"');
  });

  await then(
    '"suite/web-7/task.toml" has in "[metadata]" the source "https://github.com/acme/web/pull/7", the merge commit and its parent commit',
    async () => {
      const toml = await sut.files.read("$OUTPUT/suite/web-7/task.toml");
      const metadata = toml.slice(toml.indexOf("[metadata]"), toml.indexOf("[verifier]")).split("\n");
      expect(metadata).toContain('source = "https://github.com/acme/web/pull/7"');
      expect(metadata).toContain(`merge_commit = "${pull.merge}"`);
      expect(metadata).toContain(`parent_commit = "${pull.parent}"`);
    },
  );
});
