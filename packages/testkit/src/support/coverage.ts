// REACH: loaded with --import into every Node process of the module under test. When the testkit sets
// OSF_TESTKIT_COVERAGE, it records which code below OSF_TESTKIT_COVERAGE_ROOT the process ran and writes it on exit
// as V8 coverage JSON, the format of NODE_V8_COVERAGE, to that folder (`<repository>/reports/coverage`), with the
// repository root as `root`. The REACH check reads it.
// MUTATION: when the testkit sets OSF_TESTKIT_MUTANTS during a mutation run, the process also writes on exit the IDs
// of the mutants its instrumented code ran, so `osf mutation` reruns only the scenarios that ran a mutant (ADR 0061).
import { mkdirSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const DIR = process.env.OSF_TESTKIT_COVERAGE;
const ROOT = process.env.OSF_TESTKIT_COVERAGE_ROOT;

const writers: (() => void)[] = [];

if (DIR && ROOT) {
  const prefix = `${pathToFileURL(ROOT).href}/`;
  const session = new Session();
  session.connect();
  session.post("Profiler.enable");
  session.post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  let written = 0;
  writers.push(() => {
    // A session in the same thread answers synchronously, so this also works in an exit handler.
    session.post("Profiler.takePreciseCoverage", (error, coverage) => {
      if (error) return;
      const result = coverage.result.filter(
        (script) => script.url.startsWith(prefix) && !script.url.includes("/node_modules/"),
      );
      if (result.length === 0) return;
      mkdirSync(DIR, { recursive: true });
      const root = pathToFileURL(join(DIR, "..", "..")).href;
      writeFileSync(join(DIR, `coverage-${process.pid}-${++written}.json`), JSON.stringify({ root, result }));
    });
  });
}

const MUTANTS = process.env.OSF_TESTKIT_MUTANTS;
if (MUTANTS) {
  let written = 0;
  writers.push(() => {
    // Stryker's instrumented code counts each mutant it reaches in this global; outside a test runner in `static`.
    const ns = (globalThis as { __stryker__?: { mutantCoverage?: { static: Record<string, number> } } }).__stryker__;
    mkdirSync(MUTANTS, { recursive: true });
    const ids = Object.keys(ns?.mutantCoverage?.static ?? {});
    writeFileSync(join(MUTANTS, `mutants-${process.pid}-${++written}.json`), JSON.stringify(ids));
  });
}

if (writers.length > 0) {
  const write = (): void => {
    for (const writer of writers) writer();
  };
  process.on("exit", write);
  // A server stops on SIGTERM. Exit as Node would, unless the module handles the signal itself.
  process.on("SIGTERM", () => {
    write();
    if (process.listenerCount("SIGTERM") === 1) process.exit(143);
  });
}
