import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { capture, commitPull } from "./pulls.ts";

scenario("SCN-TASK-016", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  let pull: Awaited<ReturnType<typeof commitPull>>;
  await given('a merged GitHub pull request 7 that changes "src/sum.js" and adds "checks/sum.sh"', async () => {
    pull = await commitPull(sut, {
      change: { "src/sum.js": "export const sum = (a, b) => a + b;\n", "checks/sum.sh": 'node -e "process.exit(0)"\n' },
    });
    github = await fakes.http([pull.route]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "taskcapture capture --git . --tests ^checks/ https://github.com/acme/web/pull/7" with "TASKCAPTURE_FORGE_URL" set to the GitHub API',
    async () => {
      run = await capture(sut, github, ["--tests", "^checks/"]);
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('"suite/web-7/tests/files/checks/sum.sh" exists', async () => {
    const files = await sut.files.list("$OUTPUT/suite/web-7");
    expect(files).toContain("tests/files/checks/sum.sh");
    expect(files).not.toContain("solution/files/checks/sum.sh");
  });
});
