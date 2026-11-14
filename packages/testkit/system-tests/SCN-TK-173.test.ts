import { scenario } from "@opensoftware/testkit";
import { demoModule, GITHUB_API, GITHUB_README, testCases } from "./module.ts";

scenario("SCN-TK-173", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI reads repository "tester/demo" and the first page of its pull requests at "DEMO_GITHUB_URL"',
    async () => {
      bin = [...GITHUB_API, 'await api("GET", "");', 'await api("GET", "/pulls?per_page=1&page=1");', ""].join("\n");
    },
  );

  await given(
    'its system test expects the calls "GET /repos/tester/demo" and "GET /repos/tester/demo/pulls?per_page=1&page=1" of fakes.github',
    async () => {
      const module = demoModule({
        bin,
        readme: GITHUB_README,
        steps: ['When the user runs "demo"', "Then fakes.github lists its two calls"],
        test: [
          "const github = await fakes.github();",
          'await github.createRepository("demo");',
          "await when('the user runs \"demo\"', async () => {",
          "  const env = { DEMO_GITHUB_URL: github.url, DEMO_GITHUB_TOKEN: github.token };",
          "  await sut.cli([`${github.owner}/demo`], { env });",
          "});",
          "await then('fakes.github lists its two calls', async () => {",
          '  expect(github.calls()).toEqual(["GET /repos/tester/demo", "GET /repos/tester/demo/pulls?per_page=1&page=1"]);',
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
