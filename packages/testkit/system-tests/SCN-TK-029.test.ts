import { scenario } from "@opensoftware/testkit";
import { postModule, testCases } from "./module.ts";

scenario("SCN-TK-029", async ({ sut, given, when, then }) => {
  let routes = "";
  await given(
    'a module whose CLI posts {"n":1} to "/v1/traces" at "DEMO_API_URL" twice and prints both status codes',
    async () => {
      routes =
        '[{ method: "POST", path: "/v1/traces", status: 503, body: {}, times: 1 }, { method: "POST", path: "/v1/traces", body: {} }]';
    },
  );

  await given(
    'its system test scripts "POST /v1/traces" to answer 503 once and then 200, and expects "503 200"',
    async () => {
      const module = postModule(routes, ['expect(run.stdout).toBe("503 200");']);
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
