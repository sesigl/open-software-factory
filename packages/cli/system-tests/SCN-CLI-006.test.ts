import { check, runProgram } from "@opensoftware/cli";
import { scenario } from "@opensoftware/testkit";
import { capture, demo, lines, type Ran } from "./program.ts";

scenario("SCN-CLI-006", async ({ given, when, then }) => {
  let command: () => { lines: string[] };
  await given(
    'the program "demo" whose command checks that 0 paths were named, with the message "name at least one file"',
    async () => {
      const paths: string[] = [];
      command = () => {
        check(paths.length, "name at least one file");
        return { lines: paths };
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

  await then('standard error is "demo: name at least one file", each on its own line', async () => {
    expect(ran.stderr).toBe(lines("demo: name at least one file"));
  });
});
