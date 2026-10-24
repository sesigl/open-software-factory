import { scenario } from "@opensoftware/testkit";
import { demoModule, GITHUB_API, GITHUB_README, testCases } from "./module.ts";

scenario("SCN-TK-085", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI merges a pull request at "DEMO_GITHUB_URL" with the method "squash" and prints the merge commit',
    async () => {
      bin = [
        ...GITHUB_API,
        'const merged = await api("PUT", `/pulls/${rest[0]}/merge`, { merge_method: "squash" });',
        "process.stdout.write(merged.json.sha);",
        "",
      ].join("\n");
    },
  );

  await given(
    'its system test opens a pull request in fakes.github that creates "notes.md" and expects "main" at that commit with "notes.md"',
    async () => {
      const module = demoModule({
        bin,
        readme: GITHUB_README,
        steps: [
          'When the user runs "demo" for the pull request',
          'Then "main" is at the printed commit and holds "notes.md"',
        ],
        test: [
          "const github = await fakes.github();",
          'await github.createRepository("demo", { "app.js": "1\\n" });',
          'const pr = await github.openPullRequest("demo", { branch: "fix", title: "Add notes", files: { "notes.md": "hello\\n" } });',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\" for the pull request', async () => {",
          "  const env = { DEMO_GITHUB_URL: github.url, DEMO_GITHUB_TOKEN: github.token };",
          "  run = await sut.cli([`${github.owner}/demo`, String(pr.number)], { env });",
          "});",
          'await then(\'"main" is at the printed commit and holds "notes.md"\', async () => {',
          '  const main = (await github.branches("demo")).find((branch) => branch.name === "main");',
          "  expect(main?.sha).toBe(run.stdout);",
          "  expect(run.stdout).not.toBe(pr.sha);",
          '  expect(await github.file("demo", "notes.md", "main")).toBe("hello\\n");',
          '  expect(await github.file("demo", "app.js", "main")).toBe("1\\n");',
          '  expect((await github.pullRequests("demo"))[0]?.state).toBe("closed");',
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
