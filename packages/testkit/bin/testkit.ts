#!/usr/bin/env node
// `testkit run` runs the system tests of the module in the current directory with the testkit's settings and
// writes a JUnit report in which every test case carries its scenario ID. `testkit conformance <features>` does
// the same for an adapter and then reports, for every @conformance scenario of the port, whether it passed.
// `testkit timed <command>...` runs a package's system tests; with CI set it also writes the runner's slowdown for
// BUDGET (ADR 0103).
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import type { RunnerTask } from "vitest";

const USAGE =
  "usage: testkit run --junit <file>\n       testkit conformance <port features folder> --junit <file>\n" +
  "       testkit timed <command>...\n";
const self = fileURLToPath(import.meta.url);
const testkitEntry = join(dirname(self), "..", "src", `index${extname(self)}`);

const [command, ...rest] = process.argv.slice(2);
if (command === "timed") process.exit(await timed(rest));
if (command !== "run" && command !== "conformance") {
  process.stderr.write(`testkit: unknown command ${command ?? ""}\n${USAGE}`);
  process.exit(2);
}

const { values, positionals } = parseArgs({
  args: rest,
  options: { junit: { type: "string" } },
  allowPositionals: command === "conformance",
});
if (!values.junit) {
  process.stderr.write(`testkit: --junit is required\n${USAGE}`);
  process.exit(2);
}

const root = process.cwd();
let portFeatures: string | undefined;
let required: string[] = [];
if (command === "conformance") {
  portFeatures = positionals[0] && resolve(root, positionals[0]);
  if (!portFeatures || !existsSync(portFeatures)) {
    process.stderr.write(`testkit: the port features folder ${positionals[0] ?? ""} does not exist\n${USAGE}`);
    process.exit(2);
  }
  required = conformanceScenarios(portFeatures);
  if (required.length === 0) {
    process.stderr.write(`testkit: ${positionals[0]} has no implemented @conformance scenario\n`);
    process.exit(2);
  }
}

const { startVitest } = await import("vitest/node");
const vitest = await startVitest("test", [], {
  root,
  config: false,
  include: ["system-tests/**/*.test.ts"],
  globals: true,
  retry: 0,
  testTimeout: 120_000,
  watch: false,
  reporters: ["default", ["junit", { outputFile: resolve(root, values.junit), classnameTemplate: "{filepath}" }]],
  // The module's tests import the testkit by name; it resolves to this copy wherever the module lives.
  alias: { "@opensoftware/testkit": testkitEntry },
  // scenario() reads the status of a port's scenarios from here.
  env: portFeatures ? { OSF_TESTKIT_PORT_FEATURES: portFeatures } : {},
});
const results = new Map<string, string[]>();
for (const task of (vitest?.state.getFiles() ?? []).flatMap(leaves)) {
  results.set(task.name, [...(results.get(task.name) ?? []), task.result?.state ?? "skip"]);
}
await vitest?.close();

if (command === "conformance") {
  let passed = 0;
  for (const id of required) {
    const states = results.get(id) ?? [];
    const verdict =
      states.length === 0
        ? "has no system test"
        : states.length > 1
          ? `has ${states.length} system tests`
          : states[0] === "pass"
            ? "passed"
            : states[0] === "fail"
              ? "failed"
              : "was skipped";
    if (verdict === "passed") passed++;
    process.stdout.write(`CONFORMANCE ${id} ${verdict}\n`);
  }
  process.stdout.write(`${passed} of ${required.length} conformance scenarios passed\n`);
  if (passed < required.length) process.exitCode = 1;
}
process.exit(process.exitCode ?? 0);

/**
 * Runs the command and gives its exit code. With CI set, it measures the runner before and after the command and writes
 * `reports/runner-speed.json`, which turbo stores and replays with the JUnit report of the same run.
 */
async function timed(command: string[]): Promise<number> {
  const [program, ...args] = command;
  if (!program) {
    process.stderr.write(`testkit: name the command to run\n${USAGE}`);
    return 2;
  }
  const speed = join(dirname(self), "..", "src", "support", `runner-speed${extname(self)}`);
  const { benchmark, REFERENCE_MS } = (await import(speed)) as typeof import("../src/support/runner-speed.ts");
  const measured = process.env.CI ? [benchmark()] : [];
  const code = await new Promise<number>((done) => {
    const child = spawn(program, args, { stdio: "inherit" });
    child.on("error", (error) => {
      process.stderr.write(`testkit: ${program} did not start: ${error.message}\n`);
      done(1);
    });
    child.on("close", (exit) => done(exit ?? 1));
  });
  if (measured.length === 0) return code;
  measured.push(benchmark());
  const ms = measured.map(Math.round);
  const slowdown = Math.round((ms.reduce((sum, each) => sum + each, 0) / ms.length / REFERENCE_MS) * 1000) / 1000;
  mkdirSync("reports", { recursive: true });
  const file = join("reports", "runner-speed.json");
  writeFileSync(file, `${JSON.stringify({ benchmarkMs: ms, referenceMs: REFERENCE_MS, slowdown })}\n`);
  process.stderr.write(`testkit: the benchmark took ${ms.join(" and ")} ms, ${slowdown} times the reference\n`);
  return code;
}

function leaves(task: RunnerTask): RunnerTask[] {
  return "tasks" in task ? task.tasks.flatMap(leaves) : [task];
}

/** IDs of the implemented scenarios tagged @conformance in the folder's feature files. */
function conformanceScenarios(dir: string): string[] {
  const ids: string[] = [];
  const files = (folder: string): string[] =>
    readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? files(join(folder, entry.name))
        : entry.name.endsWith(".feature")
          ? [join(folder, entry.name)]
          : [],
    );
  for (const file of files(dir).sort()) {
    let tags: string[] = [];
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const text = line.trim();
      if (text.startsWith("@")) tags.push(...text.split(/\s+/));
      else if (/^Scenario( Outline)?:/.test(text)) {
        const id = tags.find((tag) => tag.startsWith("@id="))?.slice(4);
        if (id && tags.includes("@conformance") && tags.includes("@status=implemented")) ids.push(id);
        tags = [];
      } else if (text && !text.startsWith("#")) tags = [];
    }
  }
  return ids;
}
