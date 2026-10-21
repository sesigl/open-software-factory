import { runProgram, UsageError } from "@opensoftware/cli";
import { scenario } from "@opensoftware/testkit";
import { capture, demo, lines, type Ran } from "./program.ts";

scenario("SCN-CLI-004", async ({ given, when, then }) => {
  let command: () => never;
  await given(
    'the program "demo" whose command throws the usage error "--since takes a date like 2026-01-31"',
    async () => {
      command = () => {
        throw new UsageError("--since takes a date like 2026-01-31");
      };
    },
  );

  let ran: Ran;
  await when("the module runs the program", async () => {
    ran = await capture((io) => runProgram(demo(command), io));
  });

  await then("the exit code is 2", async () => {
    expect(ran.exitCode).toBe(2);
  });

  await then('standard error is "demo: --since takes a date like 2026-01-31", each on its own line', async () => {
    expect(ran.stderr).toBe(lines("demo: --since takes a date like 2026-01-31"));
  });

  await then("standard output is empty", async () => {
    expect(ran.stdout).toBe("");
  });
});
