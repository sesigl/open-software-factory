import { type CliResult, scenario } from "@opensoftware/testkit";
import { sandboxes } from "./sandbox.ts";

scenario("SCN-SKUBE-007", async ({ sut, when, then }) => {
  let run: CliResult;
  await when('the client runs "exec 0123456789ab --"', async () => {
    run = await sandboxes(sut).cli(["exec", "0123456789ab", "--"]);
  });

  await then(
    'the command exits with code 2 and writes "sandbox-kubernetes: name the command after --, like exec <ID> -- pwd" to standard error',
    async () => {
      expect(run.exitCode, run.stderr).toBe(2);
      expect(run.stderr).toContain("sandbox-kubernetes: name the command after --, like exec <ID> -- pwd");
    },
  );
});
