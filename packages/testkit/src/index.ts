// Bootstrap subset of @opensoftware/testkit, built in T-00 so the repository tooling can prove its own scenarios.
// T-02 adds HTTP, MCP and event handles, the fakes, NOREAL and REACH.
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { type TestContext, test } from "vitest";

export type StepFn = (label: string, body: () => unknown) => Promise<void>;

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface Sut {
  /** Runs the module's built artifact with these arguments, with $INPUT as the current directory. */
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
  };
  /** $INPUT is a Git repository with a fixed author and clock. */
  git: {
    commit(message: string): Promise<string>;
    /** Tags the current commit, for example a release tag. */
    tag(name: string): Promise<void>;
  };
}

export interface Fakes {
  /** A fixture file from the module's `system-tests/fixtures/` folder. */
  fixture(name: string): string;
  /** A read-only copy of a folder of this repository, for example `modules/_template`. */
  fromRepository(dir: string): Record<string, string>;
}

export interface ScenarioContext {
  sut: Sut;
  fakes: Fakes;
  given: StepFn;
  when: StepFn;
  then: StepFn;
}

const FIXED_DATE = "2026-01-01T00:00:00Z";

/** Declares the one system test of a scenario. The ID is a string literal so the checks can read it. */
export function scenario(id: string, body: (context: ScenarioContext) => Promise<void>): void {
  test(id, async (vitestContext: TestContext) => {
    const testFile = vitestContext.task.file.filepath;
    const moduleRoot = findModuleRoot(testFile);
    const retries = vitestContext.task.result?.retryCount ?? 0;
    await vitestContext.annotate(id, "scenario");
    if (retries > 0) await vitestContext.annotate(String(retries), "retries");

    const status = scenarioStatus(moduleRoot, id);
    const workspace = mkdtempSync(join(tmpdir(), "osf-sut-"));
    try {
      const context = makeContext(moduleRoot, folders(workspace));
      if (status !== "planned") return await body(context);
      // A planned scenario's test is expected to fail until the behavior exists.
      let failed = false;
      try {
        await body(context);
      } catch {
        failed = true;
      }
      if (!failed) throw new Error(`${id} is planned but its test passes: set @status=implemented.`);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
}

interface Folders {
  input: string;
  output: string;
}

function folders(workspace: string): Folders {
  const input = join(workspace, "input");
  const output = join(workspace, "output");
  mkdirSync(input);
  mkdirSync(output);
  return { input, output };
}

function makeContext(moduleRoot: string, dirs: Folders): ScenarioContext {
  const step =
    (keyword: string): StepFn =>
    async (label, body) => {
      try {
        await body();
      } catch (error) {
        if (error instanceof Error) error.message = `${keyword} "${label}": ${error.message}`;
        throw error;
      }
    };
  initGit(dirs.input);
  return {
    sut: makeSut(moduleRoot, dirs),
    fakes: makeFakes(moduleRoot),
    given: step("Given"),
    when: step("When"),
    // biome-ignore lint/suspicious/noThenProperty: `then` is the Gherkin keyword; the context is never awaited.
    then: step("Then"),
  };
}

function makeSut(moduleRoot: string, dirs: Folders): Sut {
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
      const folderEnv = { INPUT: dirs.input, OUTPUT: dirs.output };
      return run(process.execPath, [artifact, ...args], input, { ...baseEnv(input), ...folderEnv, ...env });
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

function makeFakes(moduleRoot: string): Fakes {
  return {
    fixture(name) {
      return readFileSync(join(moduleRoot, "system-tests", "fixtures", name), "utf8");
    },
    fromRepository(dir) {
      const root = join(repoRoot(), dir);
      const tree: Record<string, string> = {};
      for (const file of listFiles(root)) tree[relative(root, file)] = readFileSync(file, "utf8");
      return tree;
    },
  };
}

function findModuleRoot(testFile: string): string {
  for (let dir = dirname(testFile); dir !== dirname(dir); dir = dirname(dir)) {
    if (existsSync(join(dir, "features")) && existsSync(join(dir, "package.json"))) return dir;
  }
  throw new Error(`No module root (a folder with features/ and package.json) above ${testFile}`);
}

function repoRoot(): string {
  for (let dir = process.cwd(); dir !== dirname(dir); dir = dirname(dir)) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
  }
  return process.cwd();
}

function artifactOf(moduleRoot: string): string {
  const manifest = JSON.parse(readFileSync(join(moduleRoot, "package.json"), "utf8")) as {
    bin?: string | Record<string, string>;
  };
  const bin = typeof manifest.bin === "string" ? manifest.bin : Object.values(manifest.bin ?? {})[0];
  if (!bin) throw new Error(`${moduleRoot}/package.json declares no bin: the testkit has no artifact to start`);
  return join(moduleRoot, bin);
}

/** Environment variables named in backticks in the README's Configuration section. */
function documentedEnv(moduleRoot: string): Set<string> {
  const readme = join(moduleRoot, "README.md");
  if (!existsSync(readme)) return new Set();
  const section =
    readFileSync(readme, "utf8")
      .split(/^## /m)
      .find((part) => part.startsWith("Configuration")) ?? "";
  return new Set([...section.matchAll(/`([A-Z][A-Z0-9_]*)`/g)].map((match) => match[1] as string));
}

function scenarioStatus(moduleRoot: string, id: string): string | undefined {
  const tag = new RegExp(`@id=${id}\\b[^\\n]*@status=(\\w+)|@status=(\\w+)[^\\n]*@id=${id}\\b`);
  for (const file of listFiles(join(moduleRoot, "features"))) {
    if (!file.endsWith(".feature")) continue;
    const match = tag.exec(readFileSync(file, "utf8"));
    if (match) return match[1] ?? match[2];
  }
  return undefined;
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    if (entry === ".git" || entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

function baseEnv(workspace: string): Record<string, string> {
  return {
    PATH: process.env.PATH ?? "",
    HOME: workspace,
    LANG: "C.UTF-8",
    TZ: "UTC",
    NO_COLOR: "1",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_AUTHOR_NAME: "Test",
    GIT_AUTHOR_EMAIL: "test@example.invalid",
    GIT_COMMITTER_NAME: "Test",
    GIT_COMMITTER_EMAIL: "test@example.invalid",
    GIT_AUTHOR_DATE: FIXED_DATE,
    GIT_COMMITTER_DATE: FIXED_DATE,
  };
}

function initGit(workspace: string): void {
  // Synchronous on purpose: the folder must be a repository before the first step runs.
  const result = spawnSync("git", ["init", "-q", "-b", "main"], { cwd: workspace, env: baseEnv(workspace) });
  if (result.status !== 0) throw new Error(`git init failed in the working folder: ${result.stderr}`);
}

function run(command: string, args: string[], cwd: string, env: Record<string, string>): Promise<CliResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolvePromise({ exitCode: code ?? 1, stdout, stderr }));
  });
}

async function mustRun(command: string, args: string[], cwd: string): Promise<CliResult> {
  const result = await run(command, args, cwd, baseEnv(cwd));
  if (result.exitCode !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr}`);
  return result;
}
