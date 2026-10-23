import { scenario } from "@opensoftware/testkit";
import { buttonModule } from "./slack-server.ts";

scenario("SCN-TK-055", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose server posts a message with the button "approve" to "C1" and keeps the action ID and user of each signed press',
    async () => {
      module = buttonModule("merge");
    },
  );

  await given('its system test presses "merge" on that message', async () => {
    for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "has no such button: merge"', async () => {
    expect(run.stdout + run.stderr).toContain("has no such button: merge");
  });
});
