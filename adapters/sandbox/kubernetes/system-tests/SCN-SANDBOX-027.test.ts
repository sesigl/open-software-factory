import { scenario } from "@opensoftware/testkit";
import { OUTSIDE, sandboxes, TEMPLATE } from "./sandbox.ts";

// Needs a kind cluster with agent-sandbox: runs in CI only.
scenario("SCN-SANDBOX-027", async ({ sut, given, when, then }) => {
  const box = sandboxes(sut);
  await given("the test template", async () => {
    expect(TEMPLATE).not.toBe("");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the client runs "probe --allow" with the test template and the host "api.example.invalid"', async () => {
    run = await box.cli(["probe", TEMPLATE, OUTSIDE, "--allow"]);
  });

  await then('probe prints "reached api.example.invalid" and exits with code 0', async () => {
    expect(run.stdout, run.stderr).toBe(`reached ${OUTSIDE}\n`);
    expect(run.exitCode).toBe(0);
  });

  await then("the sandbox that probe names on standard error is not in the sandbox list", async () => {
    const id = /sandbox (\S+)/.exec(run.stderr)?.[1];
    expect(id, run.stderr).toBeTruthy();
    const list = await box.cli(["list"]);
    expect(list.stdout.split("\n")).not.toContain(id);
  });
});
