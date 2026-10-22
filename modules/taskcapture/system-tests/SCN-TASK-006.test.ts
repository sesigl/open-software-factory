import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { capture, commitPull } from "./pulls.ts";

scenario("SCN-TASK-006", async ({ sut, fakes, given, when, then }) => {
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

  await then('"suite/web-7/environment/repo/src/sum.js" holds "a - b"', async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    expect(await sut.files.read("$OUTPUT/suite/web-7/environment/repo/src/sum.js")).toBe(
      "export const sum = (a, b) => a - b;\n",
    );
  });

  await then('"suite/web-7/environment/repo" has no file "test/sum.test.js"', async () => {
    const files = await sut.files.list("$OUTPUT/suite/web-7/environment/repo");
    expect(files).toContain("package.json");
    expect(files).not.toContain("test/sum.test.js");
  });
});
