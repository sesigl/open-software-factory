import { scenario } from "@opensoftware/testkit";
import { demoModule, GITHUB_API, GITHUB_README, testCases } from "./module.ts";

scenario("SCN-TK-095", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI registers a webhook for "push" events and then deletes it at "DEMO_GITHUB_URL"',
    async () => {
      bin = [
        ...GITHUB_API,
        'const created = await api("POST", "/hooks", {',
        '  name: "web",',
        '  config: { url: "http://intake.example/github", content_type: "json" },',
        '  events: ["push"],',
        "});",
        "const removed = await fetch(`${process.env.DEMO_GITHUB_URL}/repos/${repository}/hooks/${created.json.id}`, {",
        '  method: "DELETE",',
        "  headers: { authorization: `Bearer ${process.env.DEMO_GITHUB_TOKEN}` },",
        "});",
        "process.stdout.write(String(removed.status));",
        "",
      ].join("\n");
    },
  );

  await given(
    "its system test only runs it and expects that fakes.github lists no webhook of the repository",
    async () => {
      const module = demoModule({
        bin,
        readme: GITHUB_README,
        steps: ['When the user runs "demo"', "Then the repository has no webhook"],
        test: [
          "const github = await fakes.github();",
          'await github.createRepository("demo");',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  const env = { DEMO_GITHUB_URL: github.url, DEMO_GITHUB_TOKEN: github.token };",
          "  run = await sut.cli([`${github.owner}/demo`], { env });",
          "});",
          'await then("the repository has no webhook", async () => {',
          '  expect(run.stdout).toBe("204");',
          '  expect(await github.hooks("demo")).toEqual([]);',
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
