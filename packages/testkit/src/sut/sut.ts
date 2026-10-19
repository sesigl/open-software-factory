// The handle on the module under test: its CLI, its input and output folders and the Git repository in $INPUT.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { artifactOf, documentedEnv, listFiles, quickStart, repoRoot } from "../support/module.ts";
import { baseEnv, type CliResult, FIXED_DATE, FIXED_SEED, mustRun, run } from "../support/process.ts";

export interface Sut {
  /**
   * Runs the module's built artifact with these arguments, with $INPUT as the current directory. The module gets
   * a fixed clock and seed as `OSF_NOW` (2026-01-01T00:00:00Z) and `OSF_SEED` (1).
   */
  cli(args: string[], options?: { env?: Record<string, string> }): Promise<CliResult>;
  /**
   * The module's input and output folders. Every path starts with `$INPUT/` or `$OUTPUT/` and stays inside that
   * folder; the module gets them as the environment variables `INPUT` and `OUTPUT`.
   */
  files: {
    put(path: string, content: string): Promise<void>;
    read(path: string): Promise<string>;
    list(dir?: string): Promise<string[]>;
    remove(path: string): Promise<void>;
    /** Removes everything inside the folder and keeps the folder. */
    clear(path: string): Promise<void>;
  };
  /** What the module's README promises in its Quick start section. */
  readme: {
    /** The arguments of the first `npx <package> ...` line. */
    quickStartArgs(): string[];
    /** The first `$OUTPUT/<path>` in backticks, as a path below $OUTPUT. */
    quickStartOutput(): string;
  };
  /** $INPUT is a Git repository with a fixed author and clock. */
  git: {
    commit(message: string): Promise<string>;
    /** Tags the current commit, for example a release tag. */
    tag(name: string): Promise<void>;
  };
}

export interface Folders {
  input: string;
  output: string;
}

export function folders(workspace: string): Folders {
  const input = join(workspace, "input");
  const output = join(workspace, "output");
  mkdirSync(input);
  mkdirSync(output);
  return { input, output };
}

export function makeSut(moduleRoot: string, dirs: Folders): Sut {
  const artifact = artifactOf(moduleRoot);
  const documented = documentedEnv(moduleRoot);
  const input = dirs.input;
  const inside = (path: string): string => {
    const [, name, rest = ""] = /^\$(INPUT|OUTPUT)(?:\/(.*))?$/s.exec(path) ?? [];
    const root = name === "INPUT" ? dirs.input : name === "OUTPUT" ? dirs.output : undefined;
    const full = root && resolve(root, rest);
    if (!root || !full || (full !== root && !full.startsWith(root + sep))) {
      throw new Error(`sut.files refuses a path outside $INPUT and $OUTPUT: ${path}`);
    }
    return full;
  };
  return {
    async cli(args, options = {}) {
      const env = options.env ?? {};
      for (const name of Object.keys(env)) {
        if (!documented.has(name)) {
          throw new Error(
            `BOUNDARY-ENV: ${name} is not documented in ${relative(repoRoot(), join(moduleRoot, "README.md"))}#configuration`,
          );
        }
      }
      const fixed = { INPUT: dirs.input, OUTPUT: dirs.output, OSF_NOW: FIXED_DATE, OSF_SEED: FIXED_SEED };
      return run(process.execPath, [artifact, ...args], input, { ...baseEnv(input), ...fixed, ...env });
    },
    files: {
      async put(path, content) {
        const full = inside(path);
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, content);
      },
      async read(path) {
        return readFileSync(inside(path), "utf8");
      },
      async list(dir = "$INPUT") {
        return listFiles(inside(dir)).map((file) => relative(inside(dir), file));
      },
      async remove(path) {
        rmSync(inside(path), { recursive: true, force: true });
      },
      async clear(path) {
        const folder = inside(path);
        for (const entry of readdirSync(folder)) rmSync(join(folder, entry), { recursive: true, force: true });
      },
    },
    readme: {
      quickStartArgs: () => quickStart(moduleRoot).args,
      quickStartOutput: () => quickStart(moduleRoot).output,
    },
    git: {
      async commit(message) {
        await mustRun("git", ["add", "-A"], input);
        await mustRun("git", ["commit", "-q", "--allow-empty", "-m", message], input);
        return (await mustRun("git", ["rev-parse", "HEAD"], input)).stdout.trim();
      },
      async tag(name) {
        await mustRun("git", ["tag", name], input);
      },
    },
  };
}
