import { type Forge, type PullRequest, scenario } from "@opensoftware/testkit";
import { NODE_REPOSITORY, SUM_FIX } from "./pulls.ts";

scenario("SCN-TASK-004", async ({ sut, fakes, given, when, then }) => {
  let forge: Forge;
  let pr: PullRequest;
  await given(
    'a Forgejo repository "tester/web" with a merged pull request 1 that adds "src/sum-fixed.js" and "test/sum.test.js"',
    async () => {
      forge = await fakes.forge();
      await forge.createRepository("web", NODE_REPOSITORY);
      pr = await forge.openPullRequest("web", {
        branch: "fix-sum",
        title: "Fix the sum",
        files: {
          "src/sum-fixed.js": SUM_FIX["src/sum.js"] as string,
          "test/sum.test.js": SUM_FIX["test/sum.test.js"] as string,
        },
      });
      await forge.mergePullRequest(pr);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture capture <forge URL>/tester/web/pulls/1"', async () => {
    run = await sut.cli(["capture", `${forge.url}/tester/web/pulls/${pr.number}`]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output says "wrote the task web-1 to"', async () => {
    expect(run.stdout).toContain("wrote the task web-1 to");
  });

  await then(
    '"$OUTPUT/suite/web-1" holds "instruction.md", "task.toml", "environment/Dockerfile", "tests/test.sh" and "solution/solve.sh"',
    async () => {
      const files = await sut.files.list("$OUTPUT/suite/web-1");
      for (const file of [
        "instruction.md",
        "task.toml",
        "environment/Dockerfile",
        "tests/test.sh",
        "solution/solve.sh",
      ])
        expect(files).toContain(file);
      expect(files).toContain("tests/files/test/sum.test.js");
      expect(files).toContain("environment/repo/src/sum.js");
    },
  );
});
