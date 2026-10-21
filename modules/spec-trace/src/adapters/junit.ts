// JUnit XML reports: one result per test case, with the scenario ID from the property `scenario` or the names.
import { readJUnitFolder, scenarioIdOf } from "@opensoftware/spec-files";
import type { Result } from "../domain/model.ts";

/** Every test case in the XML files of the folder; undefined when the folder has none. */
export function readResults(dir: string, id: RegExp): Result[] | undefined {
  const anywhere = new RegExp(id.source.replace(/^\^|\$$/g, ""));
  return readJUnitFolder(dir)?.map((test) => ({ id: scenarioIdOf(test, anywhere), status: test.status }));
}
