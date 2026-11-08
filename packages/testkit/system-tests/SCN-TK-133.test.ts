import { scenario } from "@opensoftware/testkit";
import { recordingClientModule, testCases } from "./module.ts";

scenario("SCN-TK-133", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI is an ACP client of the agent in "DEMO_AGENT_COMMAND" that opens a session in its folder and sends "fix the typo"',
    async () => {
      module = recordingClientModule({ TRACEPARENT: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01" });
    },
  );

  await given(
    'its system test starts the module with "TRACEPARENT" set to "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01", and expects one session with that folder and that variable',
    async () => {
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
