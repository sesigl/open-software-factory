// How the testkit starts the module's artifact: one command, one working folder and a checked environment.
import { extname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { artifactOf, documentedEnv, repoRoot } from "../support/module.ts";
import { baseEnv, FIXED_DATE, FIXED_SEED } from "../support/process.ts";
import type { Folders } from "./sut.ts";

export type Launch = (
  args: string[],
  env?: Record<string, string>,
) => { command: string; argv: string[]; cwd: string; env: Record<string, string> };

/** The network guard (NOREAL), next to this file in the source tree and in the built package alike. */
const GUARD = fileURLToPath(new URL(`../support/guard${extname(fileURLToPath(import.meta.url))}`, import.meta.url));

/**
 * Starts the built artifact (BOUNDARY-RUNTIME) with the network guard (NOREAL) and refuses environment variables
 * the module's README does not document (BOUNDARY-ENV). `hosts` are the hosts of the running containers.
 */
export function makeLaunch(moduleRoot: string, dirs: Folders, hosts: () => string[]): Launch {
  const artifact = artifactOf(moduleRoot);
  const source = relative(moduleRoot, artifact);
  if (source.startsWith("src/")) {
    throw new Error(
      `BOUNDARY-RUNTIME: ${relative(repoRoot(), join(moduleRoot, "package.json"))} starts ${source}; point bin at the built artifact`,
    );
  }
  const documented = documentedEnv(moduleRoot);
  return (args, env = {}) => {
    for (const name of Object.keys(env)) {
      if (!documented.has(name)) {
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
      NODE_OPTIONS: `--import=${pathToFileURL(GUARD).href}`,
      OSF_TESTKIT_NOREAL_LOG: dirs.noreal,
      OSF_TESTKIT_ALLOWED_HOSTS: hosts().join(","),
    };
    return {
      command: process.execPath,
      argv: [artifact, ...args],
      cwd: dirs.input,
      env: { ...baseEnv(dirs.input), ...fixed, ...env },
    };
  };
}
