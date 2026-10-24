import { scenario } from "@opensoftware/testkit";
import { demoModule, GITHUB_API, GITHUB_README, testCases } from "./module.ts";

scenario("SCN-TK-088", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI reads a repository at "DEMO_GITHUB_URL" with the token "not-a-token" and prints the answer\'s status and message',
    async () => {
      bin = [
        ...GITHUB_API,
        'const read = await api("GET", "");',
        "process.stdout.write(`${read.status} ${read.json.message}`);",
        "",
      ].join("\n");
    },
  );

  await given('its system test expects "401 Bad credentials"', async () => {
    const module = demoModule({
      bin,
      readme: GITHUB_README,
      steps: ['When the user runs "demo" with the token "not-a-token"', 'Then the output is "401 Bad credentials"'],
      test: [
        "const github = await fakes.github();",
        'await github.createRepository("demo");',
        "let run: Awaited<ReturnType<typeof sut.cli>>;",
        'await when(\'the user runs "demo" with the token "not-a-token"\', async () => {',
        '  const env = { DEMO_GITHUB_URL: github.url, DEMO_GITHUB_TOKEN: "not-a-token" };',
        "  run = await sut.cli([`${github.owner}/demo`], { env });",
        "});",
        "await then('the output is \"401 Bad credentials\"', async () => {",
        '  expect(run.stdout).toBe("401 Bad credentials");',
        "});",
      ],
    });
    for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
  });

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
