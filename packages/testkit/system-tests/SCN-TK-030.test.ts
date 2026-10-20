import { scenario } from "@opensoftware/testkit";
import { postModule, testCases } from "./module.ts";

scenario("SCN-TK-030", async ({ sut, given, when, then }) => {
  let routes = "";
  await given(
    'a module whose CLI posts {"n":1} to "/v1/traces" at "DEMO_API_URL" twice and prints both status codes',
    async () => {
      routes = '[{ method: "POST", path: "/v1/traces", body: {} }]';
    },
  );

  await given(
    'its system test expects the fake to have received the body {"n":1} at "POST /v1/traces" twice',
    async () => {
      const request = '{ method: "POST", path: "/v1/traces", body: { n: 1 } }';
      const module = postModule(routes, [`expect(api.received()).toEqual([${request}, ${request}]);`]);
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
