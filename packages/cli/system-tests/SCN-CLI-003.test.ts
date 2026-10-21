import { scenario } from "@opensoftware/testkit";
import { lines, type Ran, runDemo } from "./program.ts";

scenario("SCN-CLI-003", async ({ given, when, then }) => {
  let command: () => { lines: string[]; exitCode: number };
  await given('the program "demo" whose command gives the line "agreement 0.50" and the exit code 1', async () => {
    command = () => ({ lines: ["agreement 0.50"], exitCode: 1 });
  });

  let ran: Ran;
  await when("the module runs the program", async () => {
    ran = await runDemo(command);
  });

  await then("the exit code is 1", async () => {
    expect(ran.exitCode).toBe(1);
  });

  await then('standard output is "agreement 0.50", each on its own line', async () => {
    expect(ran.stdout).toBe(lines("agreement 0.50"));
  });
});
