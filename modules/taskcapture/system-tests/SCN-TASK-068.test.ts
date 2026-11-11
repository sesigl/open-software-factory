import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { capture, commitPull } from "./pulls.ts";

const UNKNOWN = "0123456789abcdef0123456789abcdef01234567";

scenario("SCN-TASK-068", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  let pull: Awaited<ReturnType<typeof commitPull>>;
  await given(
    'a merged GitHub pull request 7 that changes "src/sum.js" from "a - b" to "a + b", and a GitHub API that names a merge commit the Git repository does not have',
    async () => {
      pull = await commitPull(sut, {});
      github = await fakes.http([
        { ...pull.route, body: { ...(pull.route.body as object), merge_commit_sha: UNKNOWN } },
      ]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "taskcapture capture --git . --commit <commit of the change> https://github.com/acme/web/pull/7" with "TASKCAPTURE_FORGE_URL" set to the GitHub API',
    async () => {
      run = await capture(sut, github, ["--commit", pull.merge]);
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('"suite/web-7/solution/files/src/sum.js" holds "a + b"', async () => {
    expect(await sut.files.read("$OUTPUT/suite/web-7/solution/files/src/sum.js")).toBe(
      "export const sum = (a, b) => a + b;\n",
    );
  });

  await then('"suite/web-7/task.toml" names the commit of the change as "merge_commit"', async () => {
    const toml = await sut.files.read("$OUTPUT/suite/web-7/task.toml");
    expect(toml.split("\n")).toContain(`merge_commit = "${pull.merge}"`);
    expect(toml.split("\n")).toContain(`parent_commit = "${pull.parent}"`);
  });
});
