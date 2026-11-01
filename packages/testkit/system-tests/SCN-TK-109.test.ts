import { scenario } from "@opensoftware/testkit";
import { recordingClientModule, testCases } from "./module.ts";

scenario("SCN-TK-109", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI is an ACP client of the agent in "DEMO_AGENT_COMMAND" that opens a session in its folder and sends "fix the typo"',
    async () => {
      module = recordingClientModule({ OPENAI_MODEL: "routes/default", ANTHROPIC_BASE_URL: "http://127.0.0.1:4000" });
    },
  );

  await given(
    'its system test starts the module with "OPENAI_MODEL" set to "routes/default" and "ANTHROPIC_BASE_URL" set to "http://127.0.0.1:4000", and expects one session with that folder and those variables',
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
