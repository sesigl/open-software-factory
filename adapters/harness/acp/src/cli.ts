#!/usr/bin/env node
// harness-acp <command>: runs the ACP agent named on its command line behind the harness proxy (ADR 0050, ADR 0052).
import { check } from "@opensoftware/cli";
import { runAdapter } from "@opensoftware/harness-proxy";

const USAGE = `Usage:
  harness-acp run [--allow <kinds>] -- <agent command>...   Run the ACP agent behind the harness port on stdio.
  harness-acp transcript <session ID>                       Write the session's run record and transcript to OUTPUT.
`;

const code = await runAdapter({
  harness: "acp",
  usage: USAGE,
  agent: (args) => {
    check(args.length > 0, "name the ACP agent to run after --");
    const [command, ...rest] = args as [string, ...string[]];
    return { command, args: rest };
  },
});
// The adapter ends with its agent.
process.exit(code);
