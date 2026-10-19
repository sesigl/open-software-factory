#!/usr/bin/env node
// `testkit run`: runs the system tests of the module in the current directory with the testkit's settings and
// writes a JUnit report in which every test case carries its scenario ID.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { startVitest } from "vitest/node";

const USAGE = "usage: testkit run --junit <file>\n";
const testkitEntry = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "index.ts");

const [command, ...rest] = process.argv.slice(2);
if (command !== "run") {
  process.stderr.write(`testkit: unknown command ${command ?? ""}\n${USAGE}`);
  process.exit(2);
}

const { values } = parseArgs({ args: rest, options: { junit: { type: "string" } } });
if (!values.junit) {
  process.stderr.write(`testkit: --junit is required\n${USAGE}`);
  process.exit(2);
}

const root = process.cwd();
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
});
await vitest.close();
process.exit(process.exitCode ?? 0);
