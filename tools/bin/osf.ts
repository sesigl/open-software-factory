#!/usr/bin/env node
// Entry point of the repository tooling. `make` calls it; system tests call it through @osf/testkit.
// It always works on the repository in the current directory.
import { agentsSync } from "../scaffold/agents-sync.ts";
import { generateDocs } from "../scaffold/docs.ts";
import { newModule } from "../scaffold/new-module.ts";
import { nextId } from "../scaffold/next-id.ts";

const USAGE = `Usage: osf <command>

  check [ID ...]      run checks; no ID runs the fast set, --all runs every check
  docs-affected       list hand-written docs whose covers: paths changed since OSF_BASE
  docs [--check]      regenerate generated doc sections; --check only reports stale ones
  new-module <name> [--prefix PREFIX] [--lang ts]
  next-id <module>    print the next free scenario ID of a module
  agents-sync         link skills/ into the skill folders of every harness
`;

async function main(argv: string[]): Promise<number> {
  const [command, ...args] = argv;
  const root = process.cwd();
  switch (command) {
    case "check": {
      const { runChecks } = await import("../checks/run.ts");
      return runChecks(root, args);
    }
    case "docs-affected": {
      const { runChecks } = await import("../checks/run.ts");
      return runChecks(root, ["DOCS-AFFECTED", "--list"]);
    }
    case "docs":
      return generateDocs(root, { write: !args.includes("--check") });
    case "new-module":
      return newModule(root, args);
    case "next-id":
      return nextId(root, args);
    case "agents-sync":
      return agentsSync(root);
    case undefined:
    case "help":
    case "--help":
      process.stdout.write(USAGE);
      return command === undefined ? 2 : 0;
    default:
      process.stderr.write(`Unknown command: ${command}\n\n${USAGE}`);
      return 2;
  }
}

process.exitCode = await main(process.argv.slice(2));
