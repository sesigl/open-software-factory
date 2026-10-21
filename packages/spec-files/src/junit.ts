// JUnit XML reports: one test case per <testcase>, from <testsuites> or a lone <testsuite>.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { XMLParser } from "fast-xml-parser";

export interface TestCase {
  name: string;
  classname: string;
  /** The name of the test suite around the test case. */
  suite: string;
  /** The `<property name value>` elements of the test case. */
  properties: Record<string, string>;
  status: "passed" | "failed" | "skipped";
  /** The reruns a runner reports in `flakyFailure`, `flakyError`, `rerunFailure` and `rerunError`. */
  reruns: number;
  seconds: number;
}

const RERUNS = ["flakyFailure", "flakyError", "rerunFailure", "rerunError"];

type Xml = Record<string, unknown>;

export function parseJUnit(xml: string): TestCase[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    isArray: (name) => ["testsuite", "testcase", "property", ...RERUNS].includes(name),
  });
  const document = parser.parse(xml) as Xml;
  const suites = [
    ...(((document.testsuites as Xml | undefined)?.testsuite as Xml[] | undefined) ?? []),
    ...((document.testsuite as Xml[] | undefined) ?? []),
  ];
  return suites.flatMap((suite) =>
    ((suite.testcase as Xml[] | undefined) ?? []).map((test) => testCase(test, String(suite.name ?? ""))),
  );
}

/** Every test case of the `.xml` files in the folder, sorted by file name (readdirSync lists names sorted);
 * undefined when the folder has none. */
export function readJUnitFolder(dir: string): TestCase[] | undefined {
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((file) => file.endsWith(".xml"));
  } catch {}
  if (files.length === 0) return undefined;
  return files.flatMap((file) => parseJUnit(readFileSync(join(dir, file), "utf8")));
}

/** The scenario ID of a test case: its property `scenario`, else the first match of `id` in its name or class name. */
export function scenarioIdOf(test: TestCase, id: RegExp): string | undefined {
  return test.properties.scenario ?? id.exec(test.name)?.[0] ?? id.exec(test.classname)?.[0];
}

function testCase(test: Xml, suite: string): TestCase {
  const properties = ((test.properties as Xml | undefined)?.property as Xml[] | undefined) ?? [];
  return {
    name: String(test.name ?? ""),
    classname: String(test.classname ?? ""),
    suite,
    properties: Object.fromEntries(properties.map((entry) => [String(entry.name), String(entry.value ?? "")])),
    status: "skipped" in test ? "skipped" : "failure" in test || "error" in test ? "failed" : "passed",
    reruns: RERUNS.reduce((sum, element) => sum + ((test[element] as unknown[] | undefined)?.length ?? 0), 0),
    seconds: Number(test.time ?? 0),
  };
}
