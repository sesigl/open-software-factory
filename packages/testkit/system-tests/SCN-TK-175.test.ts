import { scenario } from "@opensoftware/testkit";
import { demoModule, GITHUB_API, GITHUB_README, testCases } from "./module.ts";

scenario("SCN-TK-175", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI prints the type, the checks and the approvals of each rule for "main" and the number of rules for "dev" at "DEMO_GITHUB_URL"',
    async () => {
      bin = [
        ...GITHUB_API,
        'const main = await api("GET", "/rules/branches/main");',
        'const dev = await api("GET", "/rules/branches/dev");',
        "const lines = main.json.map((rule) =>",
        '  rule.type === "pull_request"',
        "    ? `${rule.type} ${rule.parameters.required_approving_review_count}`",
        '    : `${rule.type} ${rule.parameters.required_status_checks.map((check) => check.context).join(",")}`,',
        ");",
        'process.stdout.write([...lines, String(dev.json.length)].join("\\n"));',
        "",
      ].join("\n");
    },
  );

  await given(
    'its system test adds a ruleset that requires the check "factory" and one approval on "main" in fakes.github and expects "required_status_checks factory", "pull_request 1" and "0"',
    async () => {
      const module = demoModule({
        bin,
        readme: GITHUB_README,
        steps: ['When the user runs "demo"', "Then the output names the two rules of main and none of dev"],
        test: [
          "const github = await fakes.github();",
          'await github.createRepository("demo");',
          'await github.addRuleset("demo", { branches: ["main"], checks: ["factory"], approvals: 1 });',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  const env = { DEMO_GITHUB_URL: github.url, DEMO_GITHUB_TOKEN: github.token };",
          "  run = await sut.cli([`${github.owner}/demo`], { env });",
          "});",
          "await then('the output names the two rules of main and none of dev', async () => {",
          '  expect(run.stdout).toBe("required_status_checks factory\\npull_request 1\\n0");',
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
