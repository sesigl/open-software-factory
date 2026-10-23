import { scenario } from "@opensoftware/testkit";
import { acpAgentModule, testCases } from "./module.ts";

scenario("SCN-TK-064", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given('a module whose ACP agent exits with code 3 after its answer to the prompt "bye"', async () => {
    module = acpAgentModule(
      ['When the client sends "bye"', "Then the module exits with code 3"],
      [
        "let code: number | null = null;",
        "await when('the client sends \"bye\"', async () => {",
        "  const client = await sut.acp.connect();",
        '  await (await client.newSession()).prompt("bye");',
        "  code = await client.exited();",
        "});",
        "await then('the module exits with code 3', async () => {",
        "  expect(code).toBe(3);",
        "});",
      ],
    );
  });

  await given('its system test sends "bye" with sut.acp and expects the exit code 3', async () => {
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
