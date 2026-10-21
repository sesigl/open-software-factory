import { join } from "node:path";
import { readJUnitFolder, scenarioIdOf } from "@opensoftware/spec-files";
import type { Repo } from "./repo.ts";

export interface TestResult {
  /** The test file, from the `classname` (Vitest with {filepath}) or the suite name. */
  file: string;
  id: string | undefined;
  status: "passed" | "failed" | "skipped";
  retries: number;
  seconds: number;
}

const ID = /SCN-[A-Z][A-Z0-9]*-\d{3}/;

function junitDir(repo: Repo): string {
  return join(repo.root, process.env.OSF_JUNIT_DIR ?? "reports/junit");
}

/** Every test case in the JUnit XML files of the results folder. Undefined when there is no result file. */
export function readResults(repo: Repo): TestResult[] | undefined {
  return readJUnitFolder(junitDir(repo))?.map((test) => {
    const file = (test.classname.includes("/") ? test.classname : test.suite).replace(/^\.\//, "");
    return {
      // Vitest writes absolute paths; the checks work with paths relative to the repository.
      file: file.startsWith(`${repo.root}/`) ? file.slice(repo.root.length + 1) : file,
      id: scenarioIdOf(test, ID),
      status: test.status,
      retries: Math.max(Number(test.properties.retries ?? 0), test.reruns),
      seconds: test.seconds,
    };
  });
}
