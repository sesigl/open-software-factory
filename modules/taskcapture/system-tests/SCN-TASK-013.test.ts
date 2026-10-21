import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { capture, commitPull } from "./pulls.ts";

scenario("SCN-TASK-013", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  let pull: Awaited<ReturnType<typeof commitPull>>;
  await given('a merged GitHub pull request 7 of a Python repository that adds "tests/test_sum.py"', async () => {
    pull = await commitPull(sut, {
      base: { "pyproject.toml": '[project]\nname = "web"\n', "web/sum.py": "def sum(a, b):\n    return a - b\n" },
      change: {
        "web/sum.py": "def sum(a, b):\n    return a + b\n",
        "tests/test_sum.py": "from web.sum import sum\n\ndef test_sum():\n    assert sum(2, 3) == 5\n",
      },
    });
    github = await fakes.http([pull.route]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "taskcapture capture --git . https://github.com/acme/web/pull/7" with "TASKCAPTURE_FORGE_URL" set to the GitHub API',
    async () => {
      run = await capture(sut, github);
    },
  );

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then(
    'the error output says "taskcapture: the repository has no package.json; set --test-command"',
    async () => {
      expect(run.stderr).toBe("taskcapture: the repository has no package.json; set --test-command\n");
    },
  );

  await then("the output folder is empty", async () => {
    expect(await sut.files.list("$OUTPUT")).toEqual([]);
  });
});
