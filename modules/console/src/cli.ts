#!/usr/bin/env node
// console <command>: the entry layer only parses arguments and calls the commands.
import { parseArgs } from "node:util";
import { type Command, runProgram } from "@opensoftware/cli";
import { serve } from "./commands/serve.ts";

const HELP = `Usage: console <command>

Commands:
  serve  Serve the read-only web view of the factory on PORT: the runs of the foremen in CONSOLE_FOREMAN_URL,
         each run's origin and evidence, and the factory definition in CONSOLE_FACTORY.
`;

const { positionals, values } = parseArgs({ allowPositionals: true, options: { help: { type: "boolean" } } });
const serving: Command | undefined = positionals[0] === "serve" ? () => serve(process.env) : undefined;
process.exitCode = await runProgram({ name: "console", usage: HELP, command: serving, help: values.help });
