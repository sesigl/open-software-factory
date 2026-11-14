import { scenario } from "@opensoftware/testkit";
import { OUTSIDE, TEMPLATE } from "./sandbox.ts";

// Needs Docker: runs in CI only.
scenario("SCN-SANDBOX-024", async ({ sut, given, when, then }) => {
  let before: string[] = [];
  await given("the sandbox list before the probe", async () => {
    const run = await sut.cli(["list"]);
    expect(run.exitCode, run.stderr).toBe(0);
    before = run.stdout.split("\n").filter(Boolean).sort();
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the client runs "probe" with the test template and the host "api.example.invalid"', async () => {
    run = await sut.cli(["probe", TEMPLATE, OUTSIDE]);
  });

  await then('probe prints "refused api.example.invalid" and exits with code 0', async () => {
    expect(run.stdout, run.stderr).toBe(`refused ${OUTSIDE}\n`);
    expect(run.exitCode).toBe(0);
  });

  await then("the sandbox list is the same as before the probe", async () => {
    const list = await sut.cli(["list"]);
    expect(list.stdout.split("\n").filter(Boolean).sort()).toEqual(before);
  });
});
