import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { capture, commitPull, SUM_TEST } from "./pulls.ts";

scenario("SCN-TASK-007", async ({ sut, fakes, given, when, then }) => {
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

  await then('"suite/web-7/tests/files/test/sum.test.js" holds the test of the pull request', async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    expect(await sut.files.read("$OUTPUT/suite/web-7/tests/files/test/sum.test.js")).toBe(SUM_TEST);
  });

  await then(
    '"suite/web-7/tests/test.sh" copies "/tests/files/." into "/app/", runs "npm test" and writes its reward to "/logs/verifier/reward.txt"',
    async () => {
      const script = (await sut.files.read("$OUTPUT/suite/web-7/tests/test.sh")).split("\n");
      expect(script[0]).toBe("#!/bin/bash");
      expect(script).toContain("cd /app");
      expect(script).toContain("cp -r /tests/files/. /app/");
      expect(script.indexOf("cp -r /tests/files/. /app/")).toBeLessThan(script.indexOf("if npm test; then"));
      expect(script).toContain("  echo 1 > /logs/verifier/reward.txt");
      expect(script).toContain("  echo 0 > /logs/verifier/reward.txt");
    },
  );
});
