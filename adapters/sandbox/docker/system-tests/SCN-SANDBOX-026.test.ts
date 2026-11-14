import { scenario } from "@opensoftware/testkit";
import { OUTSIDE, TEMPLATE } from "./sandbox.ts";

// The argument check runs before a sandbox starts.
scenario("SCN-SANDBOX-026", async ({ sut, given, when, then }) => {
  await given("the test template", async () => {
    expect(TEMPLATE).not.toBe("");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the client runs "probe" with the test template and the host "api.example.invalid/x"', async () => {
    run = await sut.cli(["probe", TEMPLATE, `${OUTSIDE}/x`]);
  });

  await then('probe exits with code 2 and names the usage "probe alpine:3 example.com"', async () => {
    expect(run.exitCode, run.stderr).toBe(2);
    expect(run.stderr).toContain("probe alpine:3 example.com");
    expect(run.stdout).toBe("");
  });
});
