import { scenario } from "@opensoftware/testkit";
import { acpAgentModule, testCases } from "./module.ts";

scenario("SCN-TK-058", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given('a module whose ACP agent keeps the turn of "wait" running until the session is cancelled', async () => {
    module = acpAgentModule(
      ['When the client sends "wait" and cancels the session', 'Then the turn ends with "cancelled"'],
      [
        'let stopReason = "";',
        "await when('the client sends \"wait\" and cancels the session', async () => {",
        "  const session = await (await sut.acp.connect()).newSession();",
        '  const turn = session.prompt("wait");',
        "  await new Promise((resolve) => setTimeout(resolve, 200));",
        "  await session.cancel();",
        "  stopReason = (await turn).stopReason;",
        "});",
        "await then('the turn ends with \"cancelled\"', async () => {",
        '  expect(stopReason).toBe("cancelled");',
        "});",
      ],
    );
  });

  await given('its system test sends "wait" with sut.acp, cancels the session and expects "cancelled"', async () => {
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
