import { scenario } from "@opensoftware/testkit";
import { lines, type Ran, runDemo } from "./program.ts";

scenario("SCN-CLI-007", async ({ given, when, then }) => {
  let usage: string;
  await given('the program "demo" with the usage "Usage: demo <command>"', async () => {
    usage = lines("Usage: demo <command>");
  });

  let ran: Ran;
  await when("the module runs the program with --help", async () => {
    ran = await runDemo(() => ({ lines: ["not run"] }), { usage, help: true });
  });

  await then("the exit code is 0", async () => {
    expect(ran.exitCode).toBe(0);
  });

  await then('standard output is "Usage: demo <command>", each on its own line', async () => {
    expect(ran.stdout).toBe(lines("Usage: demo <command>"));
  });

  await then("standard error is empty", async () => {
    expect(ran.stderr).toBe("");
  });
});
