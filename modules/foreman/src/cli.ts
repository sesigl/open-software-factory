#!/usr/bin/env node
// foreman <command>: the entry layer only parses arguments and calls the commands.
import { enableCompileCache } from "node:module";
import { parseArgs } from "node:util";
import { type Command, runProgram } from "@opensoftware/cli";

// Node keeps the compiled code of the foreman and its libraries (Temporal, Fastify, NATS) in its compile cache, in
// NODE_COMPILE_CACHE or the temporary folder: a later start loads it instead of compiling it again, about 0.3 s less.
// The commands load after it, so their imports use the cache.
enableCompileCache();

const HELP = `Usage: foreman <command>

Commands:
  serve   Serve the run API on PORT and run the factory's workflow in FOREMAN_FACTORY on Temporal at
          FOREMAN_TEMPORAL_ADDRESS.
  resend  Send the events that failed 5 times, the dead letters in NATS at FOREMAN_NATS_URL, again.
`;

const { positionals, values } = parseArgs({ allowPositionals: true, options: { help: { type: "boolean" } } });
const serving: Command = async () => (await import("./commands/serve.ts")).serve(process.env);
const resending: Command = async () => (await import("./commands/resend.ts")).resend(process.env);
const commands: Record<string, Command> = { serve: serving, resend: resending };
process.exitCode = await runProgram({
  name: "foreman",
  usage: HELP,
  command: positionals[0] ? commands[positionals[0]] : undefined,
  help: values.help,
});
