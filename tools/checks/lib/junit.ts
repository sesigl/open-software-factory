import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { XMLParser } from "fast-xml-parser";
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
const RETRY_ELEMENTS = ["flakyFailure", "flakyError", "rerunFailure", "rerunError"];

type Xml = Record<string, unknown>;

export function junitDir(repo: Repo): string {
  return join(repo.root, process.env.OSF_JUNIT_DIR ?? "reports/junit");
}

/** Every test case in the JUnit XML files of the results folder. Undefined when there is no result file. */
export function readResults(repo: Repo): TestResult[] | undefined {
  const dir = junitDir(repo);
  let files: string[];
  try {
    files = readdirSync(dir).filter((file) => file.endsWith(".xml"));
  } catch {
    return undefined;
  }
  if (files.length === 0) return undefined;
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    isArray: (name) => ["testsuite", "testcase", "property", ...RETRY_ELEMENTS].includes(name),
  });
  const results: TestResult[] = [];
  for (const file of files.sort()) {
    const xml = parser.parse(readFileSync(join(dir, file), "utf8")) as Xml;
    const suites = [
      ...(((xml.testsuites as Xml | undefined)?.testsuite as Xml[] | undefined) ?? []),
      ...((xml.testsuite as Xml[] | undefined) ?? []),
    ];
    for (const suite of suites) {
      for (const testcase of (suite.testcase as Xml[] | undefined) ?? []) {
        const result = toResult(testcase, String(suite.name ?? ""));
        // Vitest writes absolute paths; the checks work with paths relative to the repository.
        if (result.file.startsWith(`${repo.root}/`)) result.file = result.file.slice(repo.root.length + 1);
        results.push(result);
      }
    }
  }
  return results;
}

function toResult(testcase: Xml, suiteName: string): TestResult {
  const properties = ((testcase.properties as Xml | undefined)?.property as Xml[] | undefined) ?? [];
  const property = (name: string): string | undefined => {
    const found = properties.find((entry) => entry.name === name);
    return found === undefined ? undefined : String(found.value ?? "");
  };
  const name = String(testcase.name ?? "");
  const classname = String(testcase.classname ?? "");
  const id = property("scenario") ?? ID.exec(name)?.[0] ?? ID.exec(classname)?.[0];
  const reruns = RETRY_ELEMENTS.reduce(
    (sum, element) => sum + ((testcase[element] as unknown[] | undefined)?.length ?? 0),
    0,
  );
  const status = "skipped" in testcase ? "skipped" : "failure" in testcase || "error" in testcase ? "failed" : "passed";
  return {
    file: (classname.includes("/") ? classname : suiteName).replace(/^\.\//, ""),
    id,
    status,
    retries: Math.max(Number(property("retries") ?? 0), reruns),
    seconds: Number(testcase.time ?? 0),
  };
}
