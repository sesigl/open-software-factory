import { scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SANDBOX-001", async ({ sut, given, when, then }) => {
  const box = sandboxes(sut);
  try {
    let spec: Record<string, unknown> = {};
    await given("a sandbox spec with the test template", async () => {
      spec = { template: TEMPLATE };
    });

    let run: Awaited<ReturnType<typeof sut.cli>>;
    await when('the client creates a sandbox from the spec and runs "pwd" in it', async () => {
      const id = await box.create(spec);
      run = await box.cli(["exec", id, "--", "pwd"]);
    });

    await then('the command prints "/workspace" and exits with code 0', async () => {
      expect(run.stdout, run.stderr).toBe("/workspace\n");
      expect(run.exitCode).toBe(0);
    });
  } finally {
    await box.destroyAll();
  }
});
