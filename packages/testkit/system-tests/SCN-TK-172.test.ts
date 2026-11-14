import { scenario } from "@opensoftware/testkit";
import { AUTO_MERGE, demoModule, GITHUB_README } from "./module.ts";

scenario("SCN-TK-172", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI requires the check "verify" on "main" and enables auto-merge of pull request 1 twice with GitHub\'s GraphQL API at "DEMO_GITHUB_URL"',
    async () => {
      bin = [...AUTO_MERGE, 'await enable("MERGE");', 'await enable("MERGE");', ""].join("\n");
    },
  );

  await given(
    "its system test allows auto-merge in the repository of fakes.github, opens the pull request and only runs it",
    async () => {
      const module = demoModule({
        bin,
        readme: GITHUB_README,
        steps: ['When the user runs "demo"', "Then it exits with code 0"],
        test: [
          "const github = await fakes.github();",
          'await github.createRepository("demo");',
          'await github.allowAutoMerge("demo");',
          'await github.openPullRequest("demo", { branch: "fix", title: "Fix", files: { "fix.md": "1\\n" } });',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  const env = { DEMO_GITHUB_URL: github.url, DEMO_GITHUB_TOKEN: github.token };",
          "  run = await sut.cli([`${github.owner}/demo`], { env });",
          "});",
          "await then('it exits with code 0', async () => {",
          "  expect(run.exitCode).toBe(0);",
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

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "fake GitHub: auto-merge of tester/demo#1 is enabled already"', async () => {
    expect(run.stdout + run.stderr).toContain("fake GitHub: auto-merge of tester/demo#1 is enabled already");
  });
});
