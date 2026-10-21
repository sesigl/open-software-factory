import { scenario } from "@opensoftware/testkit";
import { lines, type Ran, runDemo } from "./program.ts";

scenario("SCN-CLI-005", async ({ given, when, then }) => {
  let command: () => Promise<never>;
  await given('the program "demo" whose command throws the error "connection refused"', async () => {
    command = async () => {
      throw new Error("connection refused");
    };
  });

  let ran: Ran;
  await when("the module runs the program", async () => {
    ran = await runDemo(command);
  });

  await then("the exit code is 1", async () => {
    expect(ran.exitCode).toBe(1);
  });

  await then('standard error is "demo: connection refused", each on its own line', async () => {
    expect(ran.stderr).toBe(lines("demo: connection refused"));
  });
});
