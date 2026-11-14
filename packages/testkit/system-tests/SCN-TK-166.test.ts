import { scenario } from "@opensoftware/testkit";
import { demoModule, GITHUB_API, GITHUB_README, testCases } from "./module.ts";

scenario("SCN-TK-166", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI closes pull request 1, deletes the ref of its branch twice and prints the state, "merged" and the two statuses at "DEMO_GITHUB_URL"',
    async () => {
      bin = [
        ...GITHUB_API,
        'const closed = await api("PATCH", "/pulls/1", { state: "closed" });',
        "const remove = () =>",
        "  fetch(`${process.env.DEMO_GITHUB_URL}/repos/${repository}/git/refs/heads/${closed.json.head.ref}`, {",
        '    method: "DELETE",',
        "    headers: { authorization: `Bearer ${process.env.DEMO_GITHUB_TOKEN}` },",
        "  });",
        "const first = await remove();",
        "const second = await remove();",
        "process.stdout.write(`${closed.json.state} ${closed.json.merged} ${first.status} ${second.status}`);",
        "",
      ].join("\n");
    },
  );

  await given(
    'its system test opens a pull request from "fix" in fakes.github and expects "closed false 204 422", the pull request closed and no branch "fix"',
    async () => {
      const module = demoModule({
        bin,
        readme: GITHUB_README,
        steps: [
          'When the user runs "demo"',
          'Then the output is "closed false 204 422", the pull request is closed and "fix" is gone',
        ],
        test: [
          "const github = await fakes.github();",
          'await github.createRepository("demo");',
          'await github.openPullRequest("demo", { branch: "fix", title: "Fix", files: { "fix.md": "1\\n" } });',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  const env = { DEMO_GITHUB_URL: github.url, DEMO_GITHUB_TOKEN: github.token };",
          "  run = await sut.cli([`${github.owner}/demo`], { env });",
          "});",
          'await then(\'the output is "closed false 204 422", the pull request is closed and "fix" is gone\', async () => {',
          '  expect(run.stdout).toBe("closed false 204 422");',
          '  expect((await github.pullRequests("demo"))[0]?.state).toBe("closed");',
          '  expect((await github.branches("demo")).map((branch) => branch.name)).toEqual(["main"]);',
          "});",
        ],
      });
      for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"report.xml" has the passed test case "SCN-DEMO-001"', async () => {
    expect(testCases(await sut.files.read("$INPUT/report.xml"))).toContainEqual({
      name: "SCN-DEMO-001",
      failed: false,
    });
  });
});
