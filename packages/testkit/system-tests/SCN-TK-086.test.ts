import { scenario } from "@opensoftware/testkit";
import { demoModule, GITHUB_API, GITHUB_README, testCases } from "./module.ts";

scenario("SCN-TK-086", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI protects "main" with the required check "verify" for admins too, merges a pull request at "DEMO_GITHUB_URL" and prints the answer\'s status and message',
    async () => {
      bin = [
        ...GITHUB_API,
        'await api("PUT", "/branches/main/protection", {',
        '  required_status_checks: { strict: false, contexts: ["verify"] },',
        "  enforce_admins: true,",
        "  required_pull_request_reviews: null,",
        "  restrictions: null,",
        "});",
        'const merged = await api("PUT", `/pulls/${rest[0]}/merge`, {});',
        "process.stdout.write(`${merged.status} ${merged.json.message}`);",
        "",
      ].join("\n");
    },
  );

  await given(
    "its system test opens a pull request in fakes.github and expects '405 Required status check \"verify\" is expected.'",
    async () => {
      const module = demoModule({
        bin,
        readme: GITHUB_README,
        steps: [
          'When the user runs "demo" for the pull request',
          "Then the output names the missing check and the pull request is open",
        ],
        test: [
          "const github = await fakes.github();",
          'await github.createRepository("demo");',
          'const pr = await github.openPullRequest("demo", { branch: "fix", title: "Add notes", files: { "notes.md": "hello\\n" } });',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\" for the pull request', async () => {",
          "  const env = { DEMO_GITHUB_URL: github.url, DEMO_GITHUB_TOKEN: github.token };",
          "  run = await sut.cli([`${github.owner}/demo`, String(pr.number)], { env });",
          "});",
          "await then('the output names the missing check and the pull request is open', async () => {",
          "  expect(run.stdout).toBe('405 Required status check \"verify\" is expected.');",
          '  expect((await github.pullRequests("demo"))[0]?.state).toBe("open");',
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
