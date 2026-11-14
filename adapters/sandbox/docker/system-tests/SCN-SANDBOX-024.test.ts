import { scenario } from "@opensoftware/testkit";
import { OUTSIDE, TEMPLATE } from "./sandbox.ts";

// Needs Docker: runs in CI only.
scenario("SCN-SANDBOX-024", async ({ sut, given, when, then }) => {
  await given("the test template", async () => {
    expect(TEMPLATE).not.toBe("");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the client runs "probe" with the test template and the host "api.example.invalid"', async () => {
    run = await sut.cli(["probe", TEMPLATE, OUTSIDE]);
  });

  await then('probe prints "refused api.example.invalid" and exits with code 0', async () => {
    expect(run.stdout, run.stderr).toBe(`refused ${OUTSIDE}\n`);
    expect(run.exitCode).toBe(0);
  });

  await then("the sandbox that probe names on standard error is not in the sandbox list", async () => {
    const id = /sandbox (\S+)/.exec(run.stderr)?.[1];
    expect(id, run.stderr).toBeTruthy();
    const list = await sut.cli(["list"]);
    expect(list.stdout.split("\n")).not.toContain(id);
  });
});
