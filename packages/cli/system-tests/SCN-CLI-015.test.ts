import { check, runProgram } from "@opensoftware/cli";
import { scenario } from "@opensoftware/testkit";
import { capture, demo, lines, type Ran } from "./program.ts";

scenario("SCN-CLI-015", async ({ given, when, then }) => {
  let command: () => { lines: string[] };
  await given(
    'the program "demo" whose command checks that 1 path was named, with the message "name at least one file", and gives the line "runs.jsonl"',
    async () => {
      const paths = ["runs.jsonl"];
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

  await then("the exit code is 0", async () => {
    expect(ran.exitCode).toBe(0);
  });

  await then('standard output is "runs.jsonl", each on its own line', async () => {
    expect(ran.stdout).toBe(lines("runs.jsonl"));
  });
});
