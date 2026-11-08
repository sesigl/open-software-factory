import { type CliResult, scenario } from "@opensoftware/testkit";
import { sandboxes } from "./sandbox.ts";

scenario("SCN-SKUBE-008", async ({ sut, when, then }) => {
  let run: CliResult;
  await when('the client runs "destroy 0123456789abc"', async () => {
    run = await sandboxes(sut).cli(["destroy", "0123456789abc"]);
  });

  await then(
    'the command exits with code 2 and writes "sandbox-kubernetes: name a sandbox by the 12 hex digits create printed" to standard error',
    async () => {
      expect(run.exitCode, run.stderr).toBe(2);
      expect(run.stderr).toContain("sandbox-kubernetes: name a sandbox by the 12 hex digits create printed");
    },
  );
});
