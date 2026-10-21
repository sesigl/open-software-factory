import { runProgram } from "@opensoftware/cli";
import { scenario } from "@opensoftware/testkit";
import { capture, demo, lines, type Ran } from "./program.ts";

scenario("SCN-CLI-008", async ({ given, when, then }) => {
  let usage: string;
  await given('the program "demo" with the usage "Usage: demo <command>"', async () => {
    usage = lines("Usage: demo <command>");
  });

  let ran: Ran;
  await when("the module runs the program without a command", async () => {
    ran = await capture((io) => runProgram(demo(undefined, { usage }), io));
  });

  await then("the exit code is 2", async () => {
    expect(ran.exitCode).toBe(2);
  });

  await then('standard error is "Usage: demo <command>", each on its own line', async () => {
    expect(ran.stderr).toBe(lines("Usage: demo <command>"));
  });

  await then("standard output is empty", async () => {
    expect(ran.stdout).toBe("");
  });
});
