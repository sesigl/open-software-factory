import { scenario } from "@opensoftware/testkit";
import { testCases } from "./module.ts";
import { buttonModule } from "./slack-server.ts";

scenario("SCN-TK-053", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose server posts a message with the button "approve" to "C1" and keeps the action ID and user of each signed press',
    async () => {
      module = buttonModule("approve");
    },
  );

  await given(
    'its system test presses "approve" as "U0ADA" and expects the server to have "approve U0ADA"',
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
