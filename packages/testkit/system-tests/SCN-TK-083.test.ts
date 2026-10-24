import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-083", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    `a module whose CLI posts the body '{ "n": 1 }' with its spaces to "/v1/hooks" at "DEMO_API_URL"`,
    async () => {
      bin = ['await fetch(`${process.env.DEMO_API_URL}/v1/hooks`, { method: "POST", body: \'{ "n": 1 }\' });', ""].join(
        "\n",
      );
    },
  );

  await given(`its system test expects "texts" of the fake to give '{ "n": 1 }' for that request`, async () => {
    const module = demoModule({
      bin,
      readme:
        "# demo\n\n## Configuration\n\n| Variable | Meaning |\n| --- | --- |\n| `DEMO_API_URL` | Base URL of the API. |\n",
      steps: ['When the user runs "demo"', "Then the fake gives the body's text with its spaces"],
      test: [
        'const api = await fakes.http([{ method: "POST", path: "/v1/hooks", body: {} }]);',
        "await when('the user runs \"demo\"', async () => {",
        "  await sut.cli([], { env: { DEMO_API_URL: api.url } });",
        "});",
        'await then("the fake gives the body\'s text with its spaces", async () => {',
        '  expect(api.texts()).toEqual([{ method: "POST", path: "/v1/hooks", text: \'{ "n": 1 }\' }]);',
        '  expect(api.received()).toEqual([{ method: "POST", path: "/v1/hooks", body: { n: 1 } }]);',
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
