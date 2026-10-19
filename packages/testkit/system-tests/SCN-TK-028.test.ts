import { scenario } from "@opensoftware/testkit";
import { apiModule } from "./module.ts";

scenario("SCN-TK-028", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI gets "/v0.1/servers?search=tracker" from the API at "DEMO_API_URL" and prints the body',
    async () => {
      module = apiModule("[]");
    },
  );

  await given("its system test scripts no route", async () => {
    for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "unscripted HTTP request: GET /v0.1/servers?search=tracker"', async () => {
    expect(run.stdout + run.stderr).toContain("unscripted HTTP request: GET /v0.1/servers?search=tracker");
  });
});
