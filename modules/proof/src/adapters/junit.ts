// Reads a JUnit XML report. A test case names its scenario in the property "scenario" or in its name.
import { readFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";
import { type Report, scenarioIds, type Test } from "../domain/evidence.ts";

type Xml = Record<string, unknown>;

export function junitReport(file: string): Report {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    isArray: (name) => ["testsuite", "testcase", "property"].includes(name),
  });
  const xml = parser.parse(readFileSync(file, "utf8")) as Xml;
  const suites = [
    ...(((xml.testsuites as Xml | undefined)?.testsuite as Xml[] | undefined) ?? []),
    ...((xml.testsuite as Xml[] | undefined) ?? []),
  ];
  const tests = suites.flatMap((suite) =>
    ((suite.testcase as Xml[] | undefined) ?? []).map((testcase): Test => {
      const properties = ((testcase.properties as Xml | undefined)?.property as Xml[] | undefined) ?? [];
      const scenario = properties.find((property) => property.name === "scenario")?.value;
      const title = String(testcase.name ?? "");
      return {
        title,
        ids: scenario === undefined ? scenarioIds(title) : scenarioIds(String(scenario)),
        result: "skipped" in testcase ? "skipped" : "failure" in testcase || "error" in testcase ? "failed" : "passed",
        attachments: [],
      };
    }),
  );
  return { source: file, tests };
}
