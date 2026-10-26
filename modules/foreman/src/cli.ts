#!/usr/bin/env node
// foreman <command>: the entry layer only parses arguments and calls the commands.
import { parseArgs } from "node:util";
import { type Command, runProgram } from "@opensoftware/cli";
import { serve } from "./commands/serve.ts";

const HELP = `Usage: foreman <command>

Commands:
  serve  Serve the run API on PORT and run the factory's workflow in FOREMAN_FACTORY on Temporal at
         FOREMAN_TEMPORAL_ADDRESS.
`;

const { positionals, values } = parseArgs({ allowPositionals: true, options: { help: { type: "boolean" } } });
const serving: Command = () => serve(process.env);
process.exitCode = await runProgram({
  name: "foreman",
  usage: HELP,
  command: positionals[0] === "serve" ? serving : undefined,
  help: values.help,
});
