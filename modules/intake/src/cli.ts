#!/usr/bin/env node
// intake <command>: the entry layer only parses arguments and calls the layers below it.
import { writeOutput } from "./adapters/output-folder.ts";
import { greeting } from "./domain/greeting.ts";

const [command, name] = process.argv.slice(2);
if (command === "hello" && name) {
  const file = writeOutput("hello.txt", `${greeting(name)}\n`);
  process.stdout.write(`wrote ${file}\n`);
} else {
  process.stderr.write("usage: intake hello <name>\n");
  process.exitCode = 2;
}
