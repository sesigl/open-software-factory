#!/usr/bin/env node
// console <command>: the entry layer only parses arguments and calls the commands.
import { parseArgs } from "node:util";
import { type Command, runProgram } from "@opensoftware/cli";
import { doctor } from "./commands/doctor.ts";
import { serve } from "./commands/serve.ts";

const HELP = `Usage: console <command>

Commands:
  serve  Serve the read-only web view of the factory on PORT: the runs of the foremen in CONSOLE_FOREMAN_URL,
         each run's origin and evidence, the factory definition in CONSOLE_FACTORY, and its health on /health.
  doctor Check each server of the factory, its token and the factory definition, and print one fix per failure.
         Exits 1 when a check fails. --deep also makes one model call per route of the factory definition through
         CONSOLE_MODEL_URL, asks the harness in CONSOLE_HARNESS_COMMAND to answer ACP initialize and, with
         CONSOLE_TRACES_URL, sends one span to CONSOLE_OTLP_URL and finds it in the trace store and, with
         CONSOLE_SANDBOX_COMMAND, wants a sandbox to refuse a denied host and, with CONSOLE_NATS_URL, publishes
         one doctor.ping@v1 and wants a foreman to show it within 10 seconds.
`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { help: { type: "boolean" }, deep: { type: "boolean" } },
});
const COMMANDS: Record<string, Command> = {
  serve: () => serve(process.env),
  doctor: () => doctor(process.env, values.deep),
};
const command = positionals[0] ? COMMANDS[positionals[0]] : undefined;
process.exitCode = await runProgram({ name: "console", usage: HELP, command, help: values.help });
