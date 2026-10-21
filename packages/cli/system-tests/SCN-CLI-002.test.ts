import { scenario } from "@opensoftware/testkit";
import { lines, type Ran, runDemo } from "./program.ts";

scenario("SCN-CLI-002", async ({ given, when, then }) => {
  let command: () => { errors: string[] };
  await given('the program "demo" whose command gives the error "one run failed" and no lines', async () => {
    command = () => ({ errors: ["one run failed"] });
  });

  let ran: Ran;
  await when("the module runs the program", async () => {
    ran = await runDemo(command);
  });

  await then("the exit code is 1", async () => {
    expect(ran.exitCode).toBe(1);
  });

  await then('standard error is "demo: one run failed", each on its own line', async () => {
    expect(ran.stderr).toBe(lines("demo: one run failed"));
  });

  await then("standard output is empty", async () => {
    expect(ran.stdout).toBe("");
  });
});
