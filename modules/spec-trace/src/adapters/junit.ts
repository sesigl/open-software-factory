// JUnit XML reports: one result per test case, with the scenario ID from the property `scenario` or the names.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { XMLParser } from "fast-xml-parser";
import type { Result } from "../domain/model.ts";

type Xml = Record<string, unknown>;

/** Every test case in the XML files of the folder; undefined when the folder has none. */
export function readResults(dir: string, id: RegExp): Result[] | undefined {
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((file) => file.endsWith(".xml"));
  } catch {}
  if (files.length === 0) return undefined;
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    isArray: (name) => ["testsuite", "testcase", "property"].includes(name),
  });
  const anywhere = new RegExp(id.source.replace(/^\^|\$$/g, ""));
  return files.sort().flatMap((file) => {
    const xml = parser.parse(readFileSync(join(dir, file), "utf8")) as Xml;
    const suites = [
      ...(((xml.testsuites as Xml | undefined)?.testsuite as Xml[] | undefined) ?? []),
      ...((xml.testsuite as Xml[] | undefined) ?? []),
    ];
    return suites.flatMap((suite) =>
      ((suite.testcase as Xml[] | undefined) ?? []).map((test) => toResult(test, anywhere)),
    );
  });
}

function toResult(test: Xml, id: RegExp): Result {
  const properties = ((test.properties as Xml | undefined)?.property as Xml[] | undefined) ?? [];
  const property = properties.find((entry) => entry.name === "scenario")?.value;
  const named = id.exec(String(test.name ?? ""))?.[0] ?? id.exec(String(test.classname ?? ""))?.[0];
  const status = "skipped" in test ? "skipped" : "failure" in test || "error" in test ? "failed" : "passed";
  return { id: property === undefined ? named : String(property), status };
}
