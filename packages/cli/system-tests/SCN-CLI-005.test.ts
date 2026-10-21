import { runProgram } from "@opensoftware/cli";
import { scenario } from "@opensoftware/testkit";
import { capture, demo, lines, type Ran } from "./program.ts";

scenario("SCN-CLI-005", async ({ given, when, then }) => {
  let command: () => Promise<never>;
  await given('the program "demo" whose command throws the error "connection refused"', async () => {
    command = async () => {
      throw new Error("connection refused");
    };
  });

  let ran: Ran;
  await when("the module runs the program", async () => {
    ran = await capture((io) => runProgram(demo(command), io));
  });

  await then("the exit code is 1", async () => {
    expect(ran.exitCode).toBe(1);
  });

  await then('standard error is "demo: connection refused", each on its own line', async () => {
    expect(ran.stderr).toBe(lines("demo: connection refused"));
  });
});
