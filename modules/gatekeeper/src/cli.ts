#!/usr/bin/env node
// gatekeeper <command>: the entry layer only parses arguments and calls the commands.
import { parseArgs } from "node:util";
import { type Command, outputPath, check as require, runProgram } from "@opensoftware/cli";
import { keys } from "./commands/keys.ts";
import type { Options } from "./commands/load.ts";
import { request } from "./commands/request.ts";
import { serve } from "./commands/serve.ts";
import { status } from "./commands/status.ts";
import { verify } from "./commands/verify.ts";

const GATE =
  "--policy <file.rego> --groups <file.json> (--channel slack:<channel> <request.json> | --pull-request <URL> [--channel slack:<channel>])";
const HELP = `Usage: gatekeeper <command> [options]

Commands:
  request ${GATE} [--out <file>] [--record <file>]
         Ask the approver groups of the policy in the channel, once per gate. Writes --out ($OUTPUT/gate.json).
  status ${GATE} [--record <file>]
         Decide the gate from the channel: exit 0 approved, 1 rejected or expired, 3 waiting. Writes --record ($OUTPUT/record.json).
  serve --policy <file.rego> --groups <file.json> --channel slack:<channel>
         Serve the gate API on PORT: requests over HTTP, Slack events and buttons, events through a PostgreSQL outbox.
  verify --public-key <file.pem> <record.json>
         Check the signature of a record.
  keys [--out <folder>]
         Write a new Ed25519 key pair: gatekeeper.pem for GATEKEEPER_SIGNING_KEY and gatekeeper.pub for verify.
`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    help: { type: "boolean" },
    policy: { type: "string" },
    groups: { type: "string" },
    channel: { type: "string" },
    "pull-request": { type: "string" },
    out: { type: "string" },
    record: { type: "string" },
    "public-key": { type: "string" },
  },
});
const [command, ...files] = positionals;

function policyAndGroups(): { policy: string; groups: string } {
  const { policy, groups } = values;
  require(policy, "name the policy, like --policy policy.rego");
  require(groups, "name the groups, like --groups groups.json");
  return { policy, groups };
}

function gateOptions(): Options {
  const { policy, groups } = policyAndGroups();
  require(files.length <= 1, "name one request file");
  require(!(files.length && values["pull-request"]), "name a request file or --pull-request, not both");
  return {
    policy,
    groups,
    channel: values.channel,
    pullRequest: values["pull-request"],
    file: files[0],
    out: outputPath("gate.json", values.out),
    record: outputPath("record.json", values.record),
    env: process.env,
  };
}

const commands: Record<string, Command> = {
  request: () => request(gateOptions()),
  status: () => status(gateOptions()),
  serve: () => serve({ ...policyAndGroups(), channel: values.channel, env: process.env }),
  keys: () => keys(values.out ?? process.env.OUTPUT ?? "."),
  verify: () => {
    const key = values["public-key"];
    require(key, "verify takes --public-key, like --public-key key.pub");
    require(files.length === 1, "verify takes one record file");
    return verify(files[0] as string, key);
  },
};
const chosen = command ? commands[command] : undefined;
process.exitCode = await runProgram({ name: "gatekeeper", usage: HELP, command: chosen, help: values.help });
