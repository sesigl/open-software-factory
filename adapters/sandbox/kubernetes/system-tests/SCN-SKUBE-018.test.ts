import { type CliResult, scenario } from "@opensoftware/testkit";
import { sandboxes } from "./sandbox.ts";

/** No scenario creates a sandbox in this namespace, and kubectl answers for a namespace that does not exist too. */
const EMPTY = "osf-skube-empty";

scenario("SCN-SKUBE-018", async ({ sut, given, when, then }) => {
  await given('a namespace "osf-skube-empty" without sandboxes', async () => {});

  let run: CliResult;
  await when('the client runs "list" in that namespace', async () => {
    run = await sandboxes(sut, { OSF_SANDBOX_NAMESPACE: EMPTY }).cli(["list"]);
  });

  await then("list exits with code 0 and prints nothing", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    expect(run.stdout).toBe("");
  });
});
