import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { capture, commitPull } from "./pulls.ts";

scenario("SCN-TASK-020", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  let pull: Awaited<ReturnType<typeof commitPull>>;
  await given('a suite with the task "web-7" that holds the file "tests/files/test/old.test.js"', async () => {
    await sut.files.put("$OUTPUT/suite/web-7/tests/files/test/old.test.js", "// an old capture\n");
  });

  await given('a merged GitHub pull request 7 that changes "src/sum.js" from "a - b" to "a + b" and adds "test/sum.test.js"', async () => {
    pull = await commitPull(sut, {});
    github = await fakes.http([pull.route]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture capture --git . https://github.com/acme/web/pull/7" with "TASKCAPTURE_FORGE_URL" set to the GitHub API', async () => {
    run = await capture(sut, github);
  });

  await then('"suite/web-7/tests/files/test/sum.test.js" exists', async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    expect(await sut.files.list("$OUTPUT/suite/web-7")).toContain("tests/files/test/sum.test.js");
  });

  await then('"suite/web-7" has no file "tests/files/test/old.test.js"', async () => {
    expect(await sut.files.list("$OUTPUT/suite/web-7")).not.toContain("tests/files/test/old.test.js");
  });
});
