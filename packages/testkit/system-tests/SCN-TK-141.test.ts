import { scenario } from "@opensoftware/testkit";
import { acpAgentModule, testCases } from "./module.ts";

scenario("SCN-TK-141", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given("a module whose ACP agent exits when its standard input ends", async () => {
    module = acpAgentModule(
      ["When the client hangs up", "Then the module exits with code 0"],
      [
        "let code: number | string | null = null;",
        "await when('the client hangs up', async () => {",
        "  const client = await sut.acp.connect();",
        "  await client.hangUp();",
        "  code = await Promise.race([client.exited(), new Promise<string>((done) => setTimeout(() => done('still running'), 5000))]);",
        "});",
        "await then('the module exits with code 0', async () => {",
        "  expect(code).toBe(0);",
        "});",
      ],
    );
  });

  await given("its system test connects with sut.acp, hangs up and expects the exit code 0", async () => {
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
