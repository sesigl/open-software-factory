import { runProgram } from "@opensoftware/cli";
import { scenario } from "@opensoftware/testkit";
import { capture, demo, lines, type Ran } from "./program.ts";

scenario("SCN-CLI-001", async ({ given, when, then }) => {
  let command: () => { lines: string[] };
  await given('the program "demo" whose command gives the lines "a" and "b"', async () => {
    command = () => ({ lines: ["a", "b"] });
  });

  let ran: Ran;
  await when("the module runs the program", async () => {
    ran = await capture((io) => runProgram(demo(command), io));
  });

  await then("the exit code is 0", async () => {
    expect(ran.exitCode).toBe(0);
  });

  await then('standard output is "a", "b", each on its own line', async () => {
    expect(ran.stdout).toBe(lines("a", "b"));
  });

  await then("standard error is empty", async () => {
    expect(ran.stderr).toBe("");
  });
});
