#!/usr/bin/env node
// Entry point of the repository tooling. `make` and package scripts call it; system tests call it through
// @osf/testkit. It works on the Git repository that contains the current directory.
import { spawnSync } from "node:child_process";
import { relative, resolve } from "node:path";
import { agentsSync } from "../scaffold/agents-sync.ts";
import { generateDocs } from "../scaffold/docs.ts";
import { installTools } from "../scaffold/install-tools.ts";
import { newModule } from "../scaffold/new-module.ts";
import { nextId } from "../scaffold/next-id.ts";
import { testScenario } from "../scaffold/test-scenario.ts";

const USAGE = `Usage: osf <command>

  check [ID ...]          run checks; no ID runs the fast set, --all runs every check
  docs-affected           list hand-written docs whose covers: paths changed since OSF_BASE
  docs [PATH] [--check]   regenerate generated README sections (under PATH); --check only reports stale ones
  new-module <name> [--prefix PREFIX]
  next-id <module>        print the next free scenario ID of a module or prefix
  test-scenario <ID>      run the one system test of a scenario
  agents-sync             link skills/ into the skill folders of every harness
  install-tools           download the pinned lychee and oasdiff binaries into .tools/bin
  protect-paths [FILE]    PreToolUse guard: exit 2 for an edit to a protected path (event JSON in FILE or stdin)
`;

function repositoryRoot(): string {
  const git = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  return git.status === 0 ? git.stdout.trim() : process.cwd();
}

async function main(argv: string[]): Promise<number> {
  const [command, ...args] = argv;
  const root = repositoryRoot();
  switch (command) {
    case "check": {
      const { runChecks } = await import("../checks/run.ts");
      return runChecks(root, args);
    }
    case "docs-affected": {
      const { runChecks } = await import("../checks/run.ts");
      return runChecks(root, ["DOCS-AFFECTED", "--list"]);
    }
    case "docs": {
      const path = args.find((arg) => !arg.startsWith("--"));
      const under = path === undefined ? undefined : relative(root, resolve(path));
      return generateDocs(root, { write: !args.includes("--check"), under });
    }
    case "new-module":
      return newModule(root, args);
    case "next-id":
      return nextId(root, args);
    case "test-scenario":
      return testScenario(root, args);
    case "agents-sync":
      return agentsSync(root);
    case "install-tools":
      return installTools(root);
    case "protect-paths": {
      const { protectPaths } = await import("../hooks/protect-paths.ts");
      return protectPaths(root, args);
    }
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
