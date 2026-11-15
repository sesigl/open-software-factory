import { type Command, commandOf, runProgram } from "@opensoftware/cli";
import { scenario } from "@opensoftware/testkit";
import { capture, demo, lines, type Ran } from "./program.ts";

scenario("SCN-CLI-020", async ({ given, when, then }) => {
  let commands: Record<string, Command> = {};
  await given('the commands "serve" and "doctor" of the program "demo"', async () => {
    commands = { serve: () => ({ lines: ["serving"] }), doctor: () => ({ lines: ["all checks ok"] }) };
  });

  let found: (Command | undefined)[] = [];
  let ran: Ran;
  await when('the module asks commandOf for "serve", "deploy", "toString", "constructor" and no name', async () => {
    found = ["serve", "deploy", "toString", "constructor", undefined].map((name) => commandOf(commands, name));
    ran = await capture((io) => runProgram(demo(commandOf(commands, "toString")), io));
  });

  await then('it gives the command "serve" for "serve"', async () => {
    expect(found[0]).toBe(commands.serve);
  });

  await then('it gives no command for "deploy", "toString", "constructor" and no name', async () => {
    expect(found.slice(1)).toEqual([undefined, undefined, undefined, undefined]);
  });

  await then(
    'the program "demo" run with the command of "toString" prints the usage to standard error and exits with code 2',
    async () => {
      expect([ran.exitCode, ran.stderr, ran.stdout]).toEqual([2, lines("Usage: demo <command>"), ""]);
    },
  );
});
