// How the testkit starts the module's artifact: one command, one working folder and a checked environment.
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { artifactOf, moduleEnv, repoRoot, workspaceOf } from "../support/module.ts";
import { isDocumented } from "../support/readme.ts";
import { baseEnv, FIXED_DATE, FIXED_SEED } from "../support/process.ts";
import type { Folders } from "./sut.ts";

export type Launch = (
  args: string[],
  env?: Record<string, string>,
) => { command: string; argv: string[]; cwd: string; env: Record<string, string> };

// Loaded into every module process: the network guard (NOREAL) and the coverage recorder (REACH). They sit next
// to this file in the source tree and in the built package alike.
const preload = (name: string): string =>
  `--import=${new URL(`../support/${name}${extname(fileURLToPath(import.meta.url))}`, import.meta.url).href}`;
// The recorder comes first, so it also sees the guard run.
const NODE_OPTIONS = `${preload("coverage")} ${preload("guard")}`;

function builtArtifact(moduleRoot: string): string {
  const artifact = artifactOf(moduleRoot);
  const source = relative(moduleRoot, artifact);
  if (source.startsWith("src/")) {
    throw new Error(
      `BOUNDARY-RUNTIME: ${relative(repoRoot(), join(moduleRoot, "package.json"))} starts ${source}; point bin at the built artifact`,
    );
  }
  return artifact;
}

/**
 * Starts the built artifact (BOUNDARY-RUNTIME) with the network guard (NOREAL) and refuses environment variables
 * the module's README does not document (BOUNDARY-ENV). `hosts` are the hosts of the running containers.
 */
export function makeLaunch(moduleRoot: string, dirs: Folders, hosts: () => string[]): Launch {
  // A library in packages/ has no bin: its tests never launch it, so the artifact is looked up on the first launch.
  let artifact: string | undefined;
  const documented = moduleEnv(moduleRoot);
  const coverage = coverageEnv(moduleRoot);
  return (args, env = {}) => {
    artifact ??= builtArtifact(moduleRoot);
    for (const name of Object.keys(env)) {
      if (!isDocumented(documented, name)) {
        throw new Error(
          `BOUNDARY-ENV: ${name} is not documented in ${relative(repoRoot(), join(moduleRoot, "README.md"))}#configuration`,
        );
      }
    }
    const fixed = {
      INPUT: dirs.input,
      OUTPUT: dirs.output,
      OSF_DATA: dirs.data,
      OSF_NOW: FIXED_DATE,
      OSF_SEED: FIXED_SEED,
      NODE_OPTIONS,
      OSF_TESTKIT_NOREAL_LOG: dirs.noreal,
      OSF_TESTKIT_ALLOWED_HOSTS: hosts().join(","),
      ...coverage,
      ...mutantEnv(),
    };
    return {
      command: process.execPath,
      argv: [artifact, ...args],
      cwd: dirs.input,
      env: { ...baseEnv(dirs.input), ...fixed, ...env },
    };
  };
}

/**
 * Where the module's processes record coverage: `reports/coverage/` of the workspace the module is in. A module
 * outside a workspace, such as a demo module of the testkit's own tests, records into the coverage of the module
 * that runs it, so code of that module that runs in it still counts.
 */
function coverageEnv(moduleRoot: string): Record<string, string> {
  const workspace = workspaceOf(moduleRoot);
  if (workspace) {
    return { OSF_TESTKIT_COVERAGE: join(workspace, "reports", "coverage"), OSF_TESTKIT_COVERAGE_ROOT: moduleRoot };
  }
  const { OSF_TESTKIT_COVERAGE: dir, OSF_TESTKIT_COVERAGE_ROOT: root } = process.env;
  return dir && root ? { OSF_TESTKIT_COVERAGE: dir, OSF_TESTKIT_COVERAGE_ROOT: root } : {};
}

/**
 * MUTATION: during a mutation run Stryker names the active mutant in this variable. The module's code reads it in
 * its own process, so the testkit passes it on.
 */
function mutantEnv(): Record<string, string> {
  const mutant = process.env.__STRYKER_ACTIVE_MUTANT__;
  return mutant ? { __STRYKER_ACTIVE_MUTANT__: mutant } : {};
}
