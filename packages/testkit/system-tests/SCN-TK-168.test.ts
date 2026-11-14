import { scenario } from "@opensoftware/testkit";
import { demoModule, GITHUB_API, GITHUB_README, testCases } from "./module.ts";

scenario("SCN-TK-168", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI moves "fix" to the head commit of "main" without force and then with force, and prints the status and message of the first and the status of the second at "DEMO_GITHUB_URL"',
    async () => {
      bin = [
        ...GITHUB_API,
        'const main = await api("GET", "/git/ref/heads/main");',
        "const sha = main.json.object.sha;",
        'const back = await api("PATCH", "/git/refs/heads/fix", { sha });',
        'const forced = await api("PATCH", "/git/refs/heads/fix", { sha, force: true });',
        "process.stdout.write(`${back.status} ${back.json.message} ${forced.status}`);",
        "",
      ].join("\n");
    },
  );

  await given(
    'its system test creates the branch "fix" in fakes.github and expects "422 Update is not a fast forward 200" and "fix" at the head commit of "main"',
    async () => {
      const module = demoModule({
        bin,
        readme: GITHUB_README,
        steps: [
          'When the user runs "demo"',
          'Then the output is "422 Update is not a fast forward 200" and "fix" is at the head of "main"',
        ],
        test: [
          "const github = await fakes.github();",
          'await github.createRepository("demo");',
          'await github.createBranch("demo", { branch: "fix", files: { "notes.md": "hello\\n" } });',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  const env = { DEMO_GITHUB_URL: github.url, DEMO_GITHUB_TOKEN: github.token };",
          "  run = await sut.cli([`${github.owner}/demo`], { env });",
          "});",
          'await then(\'the output is "422 Update is not a fast forward 200" and "fix" is at the head of "main"\', async () => {',
          '  expect(run.stdout).toBe("422 Update is not a fast forward 200");',
          '  const [fix, main] = await github.branches("demo");',
          "  expect(fix?.sha).toBe(main?.sha);",
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
