import { type CliResult, scenario } from "@opensoftware/testkit";
import { sandboxes } from "./sandbox.ts";

scenario("SCN-SKUBE-006", async ({ sut, when, then }) => {
  let run: CliResult;
  await when('the client runs "create"', async () => {
    run = await sandboxes(sut).cli(["create"]);
  });

  await then(
    'the command exits with code 2 and writes "sandbox-kubernetes: name the sandbox spec, like create spec.json" to standard error',
    async () => {
      expect(run.exitCode, run.stderr).toBe(2);
      expect(run.stderr).toContain("sandbox-kubernetes: name the sandbox spec, like create spec.json");
    },
  );
});
