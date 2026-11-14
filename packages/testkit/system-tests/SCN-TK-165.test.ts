import { scenario } from "@opensoftware/testkit";
import { demoModule, GITHUB_API, GITHUB_README, testCases } from "./module.ts";

scenario("SCN-TK-165", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI protects "main" with the required check "verify" and one approval, and prints the checks and approvals of the protection of "main" and the status and message of the protection of "dev" at "DEMO_GITHUB_URL"',
    async () => {
      bin = [
        ...GITHUB_API,
        'await api("PUT", "/branches/main/protection", {',
        '  required_status_checks: { strict: false, contexts: ["verify"] },',
        "  enforce_admins: true,",
        "  required_pull_request_reviews: { required_approving_review_count: 1 },",
        "  restrictions: null,",
        "});",
        'const main = await api("GET", "/branches/main/protection");',
        'const dev = await api("GET", "/branches/dev/protection");',
        "const checks = main.json.required_status_checks.contexts.join(',');",
        "const approvals = main.json.required_pull_request_reviews.required_approving_review_count;",
        "process.stdout.write(`${checks} ${approvals} ${dev.status} ${dev.json.message}`);",
        "",
      ].join("\n");
    },
  );

  await given(
    'its system test creates the branch "dev" in fakes.github and expects "verify 1 404 Branch not protected"',
    async () => {
      const module = demoModule({
        bin,
        readme: GITHUB_README,
        steps: ['When the user runs "demo"', 'Then the output is "verify 1 404 Branch not protected"'],
        test: [
          "const github = await fakes.github();",
          'await github.createRepository("demo");',
          'await github.createBranch("demo", { branch: "dev", files: { "dev.md": "dev\\n" } });',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  const env = { DEMO_GITHUB_URL: github.url, DEMO_GITHUB_TOKEN: github.token };",
          "  run = await sut.cli([`${github.owner}/demo`], { env });",
          "});",
          "await then('the output is \"verify 1 404 Branch not protected\"', async () => {",
          '  expect(run.stdout).toBe("verify 1 404 Branch not protected");',
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
