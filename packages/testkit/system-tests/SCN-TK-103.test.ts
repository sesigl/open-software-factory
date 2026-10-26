import { scenario } from "@opensoftware/testkit";
import { demoModule, FORGE_API, FORGE_README, testCases } from "./module.ts";

scenario("SCN-TK-103", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI prints the title and the label names of issue 1 of a repository at "DEMO_FORGE_URL"',
    async () => {
      bin = [
        ...FORGE_API,
        'const issue = await api("GET", `/issues/${rest[0]}`);',
        'process.stdout.write(`${issue.title} ${issue.labels.map((label) => label.name).join(",")}`);',
        "",
      ].join("\n");
    },
  );

  await given(
    'its system test opens the issue "Export reports as CSV" in fakes.forge, adds the label "factory" and expects "Export reports as CSV factory"',
    async () => {
      const module = demoModule({
        bin,
        readme: FORGE_README,
        steps: ['When the user runs "demo"', 'Then the output is "Export reports as CSV factory"'],
        test: [
          "const forge = await fakes.forge();",
          'await forge.createRepository("demo");',
          'const issue = await forge.openIssue("demo", { title: "Export reports as CSV" });',
          'await forge.label("demo", issue.number, "factory");',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  const env = { DEMO_FORGE_URL: forge.url, DEMO_FORGE_TOKEN: forge.token };",
          "  run = await sut.cli([`${forge.owner}/demo`, String(issue.number)], { env });",
          "});",
          "await then('the output is \"Export reports as CSV factory\"', async () => {",
          '  expect(run.stdout, run.stderr).toBe("Export reports as CSV factory");',
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
