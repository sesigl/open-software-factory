import { scenario } from "@opensoftware/testkit";
import { demoModule, GITHUB_README, testCases } from "./module.ts";

scenario("SCN-TK-102", async ({ sut, given, when, then }) => {
  let bin = "";
  await given('a module whose CLI prints the title and the label names of issue 1 at "DEMO_GITHUB_URL"', async () => {
    bin = [
      "const api = (path) =>",
      "  fetch(`${process.env.DEMO_GITHUB_URL}${path}`, {",
      "    headers: { authorization: `Bearer ${process.env.DEMO_GITHUB_TOKEN}` },",
      "  }).then((response) => response.json());",
      'const issue = await api("/repos/tester/demo/issues/1");',
      'process.stdout.write(`${issue.title} ${issue.labels.map((label) => label.name).join(",")}`);',
      "",
    ].join("\n");
  });

  await given(
    'its system test opens the issue "Export reports as CSV" in fakes.github, adds the label "factory" and expects "Export reports as CSV factory"',
    async () => {
      const module = demoModule({
        bin,
        readme: GITHUB_README,
        steps: ['When the user runs "demo"', 'Then the output is "Export reports as CSV factory"'],
        test: [
          "const github = await fakes.github();",
          'await github.createRepository("demo");',
          'const issue = await github.openIssue("demo", { title: "Export reports as CSV" });',
          'await github.label("demo", issue.number, "factory");',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  run = await sut.cli([], { env: { DEMO_GITHUB_URL: github.url, DEMO_GITHUB_TOKEN: github.token } });",
          "});",
          "await then('the output is \"Export reports as CSV factory\"', async () => {",
          '  expect(run.stdout).toBe("Export reports as CSV factory");',
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
