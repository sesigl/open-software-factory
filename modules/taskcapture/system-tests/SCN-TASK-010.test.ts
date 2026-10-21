import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { capture, commitPull, NODE_REPOSITORY, SUM_TEST } from "./pulls.ts";

scenario("SCN-TASK-010", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  let pull: Awaited<ReturnType<typeof commitPull>>;
  await given(
    'a merged GitHub pull request 7 that adds "test/sum.test.js" and deletes "test/minus.test.js"',
    async () => {
      pull = await commitPull(sut, {
        base: { ...NODE_REPOSITORY, "test/minus.test.js": "// the old test\n" },
        change: { "test/sum.test.js": SUM_TEST },
        deletes: ["test/minus.test.js"],
      });
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

  await then(
    '"suite/web-7/tests/test.sh" holds the line "rm -f -- \'test/minus.test.js\'" before the line "if npm test; then"',
    async () => {
      expect(run.exitCode, run.stderr).toBe(0);
      const script = (await sut.files.read("$OUTPUT/suite/web-7/tests/test.sh")).split("\n");
      expect(script).toContain("rm -f -- 'test/minus.test.js'");
      expect(script.indexOf("rm -f -- 'test/minus.test.js'")).toBeLessThan(script.indexOf("if npm test; then"));
    },
  );
});
