// How the testkit starts the module's artifact: one command, one working folder and a checked environment.
import { join, relative } from "node:path";
import { artifactOf, documentedEnv, repoRoot } from "../support/module.ts";
import { baseEnv, FIXED_DATE, FIXED_SEED } from "../support/process.ts";
import type { Folders } from "./sut.ts";

export type Launch = (
  args: string[],
  env?: Record<string, string>,
) => { command: string; argv: string[]; cwd: string; env: Record<string, string> };

/** Refuses environment variables the module's README does not document (BOUNDARY-ENV). */
export function makeLaunch(moduleRoot: string, dirs: Folders): Launch {
  const artifact = artifactOf(moduleRoot);
  const documented = documentedEnv(moduleRoot);
  return (args, env = {}) => {
    for (const name of Object.keys(env)) {
      if (!documented.has(name)) {
        throw new Error(
          `BOUNDARY-ENV: ${name} is not documented in ${relative(repoRoot(), join(moduleRoot, "README.md"))}#configuration`,
        );
      }
    }
    const fixed = { INPUT: dirs.input, OUTPUT: dirs.output, OSF_NOW: FIXED_DATE, OSF_SEED: FIXED_SEED };
    return {
      command: process.execPath,
      argv: [artifact, ...args],
      cwd: dirs.input,
      env: { ...baseEnv(dirs.input), ...fixed, ...env },
    };
  };
}
