import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { capture, commitPull, NODE_REPOSITORY, SUM_TEST } from "./pulls.ts";

scenario("SCN-TASK-009", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  let pull: Awaited<ReturnType<typeof commitPull>>;
  await given('a merged GitHub pull request 7 that adds "test/sum.test.js" and deletes "src/minus.js"', async () => {
    pull = await commitPull(sut, {
      base: { ...NODE_REPOSITORY, "src/minus.js": "export const minus = (a, b) => a - b;\n" },
      change: { "test/sum.test.js": SUM_TEST },
      deletes: ["src/minus.js"],
    });
    github = await fakes.http([pull.route]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture capture --git . https://github.com/acme/web/pull/7" with "TASKCAPTURE_FORGE_URL" set to the GitHub API', async () => {
    run = await capture(sut, github);
  });

  await then('"suite/web-7/solution/solve.sh" holds the line "rm -f -- \'src/minus.js\'"', async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    expect((await sut.files.read("$OUTPUT/suite/web-7/solution/solve.sh")).split("\n")).toContain("rm -f -- 'src/minus.js'");
  });
});
