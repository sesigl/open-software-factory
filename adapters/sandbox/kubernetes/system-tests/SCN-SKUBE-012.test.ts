import { type CliResult, scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SKUBE-012", async ({ sut, given, when, then }) => {
  const box = sandboxes(sut);
  let id = "";
  await given("a sandbox created from a spec with the test template", async () => {
    id = await box.create({ template: TEMPLATE });
  });

  let run: CliResult;
  await when("the client destroys the sandbox", async () => {
    run = await box.cli(["destroy", id]);
  });

  await then('destroy exits with code 0 and prints "destroyed <ID>"', async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    expect(run.stdout).toBe(`destroyed ${id}\n`);
  });
});
