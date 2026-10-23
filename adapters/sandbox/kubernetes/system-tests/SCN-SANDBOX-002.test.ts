import { scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SANDBOX-002", async ({ sut, given, when, then }) => {
  const box = sandboxes(sut);
  try {
    let id = "";
    await given("a sandbox created from a spec with the test template", async () => {
      id = await box.create({ template: TEMPLATE });
    });

    let run: Awaited<ReturnType<typeof sut.cli>>;
    await when('the client runs "exit 3" in the sandbox', async () => {
      run = await box.sh(id, "exit 3");
    });

    await then("exec exits with code 3", async () => {
      expect(run.exitCode, run.stderr).toBe(3);
    });
  } finally {
    await box.destroyAll();
  }
});
