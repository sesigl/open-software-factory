import { scenario } from "@opensoftware/testkit";
import { demoModule, GITHUB_README, testCases } from "./module.ts";

scenario("SCN-TK-098", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI prints the files of pull request 1 and its labels and "draft" at "DEMO_GITHUB_URL"',
    async () => {
      bin = [
        "const api = (path) =>",
        "  fetch(`${process.env.DEMO_GITHUB_URL}${path}`, {",
        "    headers: { authorization: `Bearer ${process.env.DEMO_GITHUB_TOKEN}` },",
        "  }).then((response) => response.json());",
        'const files = await api("/repos/tester/demo/pulls/1/files");',
        'const pull = await api("/repos/tester/demo/pulls/1");',
        'process.stdout.write(`${files.map((file) => file.filename).join(",")} ${JSON.stringify(pull.labels)} ${pull.draft}`);',
        "",
      ].join("\n");
    },
  );

  await given(
    'its system test opens a pull request in fakes.github that changes "checkout.js" and expects "checkout.js [] false"',
    async () => {
      const module = demoModule({
        bin,
        readme: GITHUB_README,
        steps: ['When the user runs "demo"', 'Then the output is "checkout.js [] false"'],
        test: [
          "const github = await fakes.github();",
          'await github.createRepository("demo");',
          'await github.openPullRequest("demo", { branch: "fix", title: "Fix checkout", files: { "checkout.js": "fixed\\n" } });',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  run = await sut.cli([], { env: { DEMO_GITHUB_URL: github.url, DEMO_GITHUB_TOKEN: github.token } });",
          "});",
          "await then('the output is \"checkout.js [] false\"', async () => {",
          '  expect(run.stdout).toBe("checkout.js [] false");',
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
