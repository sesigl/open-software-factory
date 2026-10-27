#!/usr/bin/env node
// intake <command>: the entry layer only parses arguments and calls the commands.
import { parseArgs } from "node:util";
import { type Command, runProgram } from "@opensoftware/cli";
import { mcp } from "./commands/mcp.ts";
import { serve } from "./commands/serve.ts";

const HELP = `Usage: intake <command>

Commands:
  serve  Serve the work item API on PORT, Slack's events with INTAKE_SLACK_TOKEN, and publish work.received@v1
         and follow the runs' events with INTAKE_NATS_URL.
  mcp    Serve the Factory MCP server on stdio: submit_work and work_status call the server at INTAKE_URL,
         run_evidence also the foreman at INTAKE_FOREMAN_URL.
`;

const { positionals, values } = parseArgs({ allowPositionals: true, options: { help: { type: "boolean" } } });
const commands: Record<string, Command> = {
  serve: () => serve(process.env),
  mcp: () => mcp(process.env),
};
const chosen = positionals[0] ? commands[positionals[0]] : undefined;
process.exitCode = await runProgram({ name: "intake", usage: HELP, command: chosen, help: values.help });
