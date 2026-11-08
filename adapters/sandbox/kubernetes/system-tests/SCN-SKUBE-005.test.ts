import { type CliResult, scenario } from "@opensoftware/testkit";
import { sandboxes } from "./sandbox.ts";

scenario("SCN-SKUBE-005", async ({ sut, when, then }) => {
  let run: CliResult;
  await when('the client runs "--help"', async () => {
    run = await sandboxes(sut).cli(["--help"]);
  });

  await then('the command exits with code 0 and prints "exec <ID> -- <command>..." and "egress-log <ID>"', async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    expect(run.stdout).toContain("exec <ID> -- <command>...");
    expect(run.stdout).toContain("egress-log <ID>");
  });
});
