#!/usr/bin/env node
// Entry point of the repository tooling. `make` and package scripts call it; system tests call it through
// @opensoftware/testkit. It works on the Git repository that contains the current directory.
import { spawnSync } from "node:child_process";
import module from "node:module";
import { relative, resolve } from "node:path";

// Node keeps the compiled code of the tooling in its temporary folder, so each later start skips the compile step.
// The modules of a command load only when it runs: system tests start osf many times (ADR 0079).
module.enableCompileCache?.();

const USAGE = `Usage: osf <command>

  bundle <package>        build a CLI package as one bundled file with its license notices (ADR 0079)
  check [ID ...]          run checks; no ID runs the fast set, --all runs every check
  collect-reports         copy each package's reports/ to reports/junit/<name>.xml and reports/coverage/ (ADR 0081)
  docs-affected           list hand-written docs whose covers: paths changed since OSF_BASE
  docs [PATH] [--check]   regenerate generated README sections (under PATH); --check only reports stale ones
  new-module <name> [--prefix PREFIX]
  next-id <module>        print the next free scenario ID of a module or prefix
  release-files           write the publish workflow and release-please entries of every published package
  test-scenario <ID>      run the one system test of a scenario
  mutation <folder> [--all] [--list] [--shard i/n]
                          Stryker on the lines of a module changed since OSF_BASE (--all: every line)
  install-tools           download the pinned lychee, oasdiff, opa, temporal and nats-server binaries into .tools/bin
`;

function repositoryRoot(): string {
  const git = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  return git.status === 0 ? git.stdout.trim() : process.cwd();
}

async function main(argv: string[]): Promise<number> {
  const [command, ...args] = argv;
  const root = repositoryRoot();
  switch (command) {
    case "bundle":
      return (await import("../scaffold/bundle.ts")).bundle(root, args);
    case "check": {
      const { runChecks } = await import("../checks/run.ts");
      return runChecks(root, args);
    }
    case "collect-reports":
      return (await import("../scaffold/collect-reports.ts")).collectReports(root);
    case "docs-affected": {
      const { runChecks } = await import("../checks/run.ts");
      return runChecks(root, ["DOCS-AFFECTED", "--list"]);
    }
    case "docs": {
      const path = args.find((arg) => !arg.startsWith("--"));
      const under = path === undefined ? undefined : relative(root, resolve(path));
      const { generateDocs } = await import("../scaffold/docs.ts");
      return generateDocs(root, { write: !args.includes("--check"), under });
    }
    case "new-module":
      return (await import("../scaffold/new-module.ts")).newModule(root, args);
    case "next-id":
      return (await import("../scaffold/next-id.ts")).nextId(root, args);
    case "release-files":
      return (await import("../scaffold/release-files.ts")).releaseFiles(root);
    case "test-scenario":
      return (await import("../scaffold/test-scenario.ts")).testScenario(root, args);
    case "mutation":
      return (await import("../scaffold/mutation.ts")).mutation(root, args);
    case "install-tools":
      return (await import("../scaffold/install-tools.ts")).installTools(root);
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
