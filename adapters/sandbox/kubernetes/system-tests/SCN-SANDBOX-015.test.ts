import { scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SANDBOX-015", async ({ sut, given, when, then }) => {
  const box = sandboxes(sut);
  let id = "";
  await given("a sandbox created from a spec with the test template", async () => {
    id = await box.create({ template: TEMPLATE });
  });

  await when("the client destroys the sandbox", async () => {
    const run = await box.cli(["destroy", id]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then("the sandbox list does not hold the sandbox", async () => {
    const run = await box.cli(["list"]);
    expect(run.exitCode, run.stderr).toBe(0);
    expect(run.stdout.split("\n")).not.toContain(id);
  });

  await then('exec in the sandbox fails with "no sandbox"', async () => {
    const run = await box.cli(["exec", id, "--", "pwd"]);
    expect(run.exitCode).toBe(1);
    expect(run.stderr).toContain(`no sandbox ${id}`);
  });
});
