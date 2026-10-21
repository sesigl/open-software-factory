// The files of one Harbor task (ADR 0043): which changed files are tests, and the text of instruction.md,
// task.toml, the Dockerfile, tests/test.sh and solution/solve.sh. The repository snapshot and the changed files'
// contents are copied by the adapters.

/** The default of --tests: test folders, *.test.*, *.spec.*, test_*.py and *_test.go. */
export const TEST_FILES = String.raw`(^|/)(tests?|__tests__|spec|system-tests)/|\.(test|spec)\.[^/]+$|(^|/)test_[^/]+\.py$|_test\.go$`;

export interface Change {
  path: string;
  deleted: boolean;
}

export interface Split {
  /** Test files the pull request added or changed: copied into tests/files/. */
  tests: string[];
  /** Test files it deleted: test.sh deletes them. */
  deletedTests: string[];
  /** Other files it added or changed: copied into solution/files/. */
  solution: string[];
  /** Other files it deleted: solve.sh deletes them. */
  deletedSolution: string[];
}

export function split(changes: Change[], tests: RegExp): Split {
  const pick = (test: boolean, deleted: boolean) =>
    changes.filter((change) => tests.test(change.path) === test && change.deleted === deleted).map((c) => c.path);
  return {
    tests: pick(true, false),
    deletedTests: pick(true, true),
    solution: pick(false, false),
    deletedSolution: pick(false, true),
  };
}

export interface Environment {
  image: string;
  /** Run once when the image is built; empty for none. */
  setup: string;
  testCommand: string;
}

/** The image, setup and test command: the options, else Node's defaults for a repository with a package.json. */
export function environment(
  options: { image?: string; setup?: string; testCommand?: string },
  hasPackageJson: boolean,
): Environment | null {
  const node = hasPackageJson ? { image: "node:24-bookworm", setup: "npm install", testCommand: "npm test" } : null;
  const testCommand = options.testCommand ?? node?.testCommand;
  if (!testCommand) return null;
  return {
    image: options.image ?? node?.image ?? "ubuntu:24.04",
    setup: options.setup ?? node?.setup ?? "",
    testCommand,
  };
}

const quote = (path: string): string => `'${path.replaceAll("'", `'\\''`)}'`;
const removals = (paths: string[]): string[] => paths.map((path) => `rm -f -- ${quote(path)}`);
const toml = (value: string): string => JSON.stringify(value);

export interface TaskSource {
  url: string;
  title: string;
  body: string;
  mergeCommit: string;
  parentCommit: string;
}

/** The text files of the task, keyed by their path in the task folder. */
export function taskFiles(source: TaskSource, split: Split, env: Environment): Record<string, string> {
  return {
    "instruction.md": `# ${source.title}\n${source.body.trim() ? `\n${source.body.trim()}\n` : ""}`,
    "task.toml": [
      'schema_version = "1.4"',
      "",
      "[metadata]",
      `source = ${toml(source.url)}`,
      `merge_commit = ${toml(source.mergeCommit)}`,
      `parent_commit = ${toml(source.parentCommit)}`,
      'captured_by = "taskcapture"',
      "",
      "[verifier]",
      "timeout_sec = 900.0",
      "",
      "[agent]",
      "timeout_sec = 1800.0",
      "",
      "[environment]",
      "build_timeout_sec = 900.0",
      "",
    ].join("\n"),
    "environment/Dockerfile": [
      `FROM ${env.image}`,
      "WORKDIR /app",
      "COPY repo/ /app/",
      ...(env.setup ? [`RUN ${env.setup}`] : []),
      "",
    ].join("\n"),
    "tests/test.sh": [
      "#!/bin/bash",
      `# Written by taskcapture from ${source.url}: its tests, hidden from the agent until now.`,
      "cd /app",
      "cp -r /tests/files/. /app/",
      ...removals(split.deletedTests),
      `if ${env.testCommand}; then`,
      "  echo 1 > /logs/verifier/reward.txt",
      "else",
      "  echo 0 > /logs/verifier/reward.txt",
      "fi",
      "",
    ].join("\n"),
    "solution/solve.sh": [
      "#!/bin/bash",
      `# Written by taskcapture from ${source.url}: its change without the tests, for Harbor's oracle agent.`,
      "cd /app",
      "cp -r /solution/files/. /app/",
      ...removals(split.deletedSolution),
      "",
    ].join("\n"),
  };
}
