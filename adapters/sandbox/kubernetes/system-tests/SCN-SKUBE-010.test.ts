import { type CliResult, scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SKUBE-010", async ({ sut, given, when, then }) => {
  const box = sandboxes(sut);
  try {
    let id = "";
    await given("a sandbox created from a spec with the test template", async () => {
      id = await box.create({ template: TEMPLATE });
    });

    let run: CliResult;
    await when('the client runs "list"', async () => {
      run = await box.cli(["list"]);
    });

    await then("list exits with code 0 and one line of its output is the sandbox's ID", async () => {
      expect(run.exitCode, run.stderr).toBe(0);
      expect(run.stdout.split("\n")).toContain(id);
    });
  } finally {
    await box.destroyAll();
  }
});
