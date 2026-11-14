import { scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

// The argument check runs before a sandbox starts.
scenario("SCN-SANDBOX-025", async ({ sut, given, when, then }) => {
  const box = sandboxes(sut);
  await given("the test template", async () => {
    expect(TEMPLATE).not.toBe("");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the client runs "probe" with the test template and no host', async () => {
    run = await box.cli(["probe", TEMPLATE]);
  });

  await then('probe exits with code 2 and names the usage "probe alpine:3 example.com"', async () => {
    expect(run.exitCode, run.stderr).toBe(2);
    expect(run.stderr).toContain("probe alpine:3 example.com");
    expect(run.stdout).toBe("");
  });
});
