#!/usr/bin/env node
// Entry point of the repository tooling. `make` and package scripts call it; system tests call it through
// @opensoftware/testkit. It works on the Git repository that contains the current directory.
import { spawnSync } from "node:child_process";
import { relative, resolve } from "node:path";
import { generateDocs } from "../scaffold/docs.ts";
import { installTools } from "../scaffold/install-tools.ts";
import { mutation } from "../scaffold/mutation.ts";
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
  mutation <folder> [--all] [--list]
                          Stryker on the lines of a module changed since OSF_BASE (--all: every line)
  install-tools           download the pinned lychee and oasdiff binaries into .tools/bin
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
    case "mutation":
      return mutation(root, args);
    case "install-tools":
      return installTools(root);
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
