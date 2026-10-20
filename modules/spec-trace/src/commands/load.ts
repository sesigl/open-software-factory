// Reads the repository in the current folder into the inputs of the rules.
import { join } from "node:path";
import { Folder } from "../adapters/files.ts";
import { parseFeature } from "../adapters/gherkin.ts";
import { readResults } from "../adapters/junit.ts";
import { readTests } from "../adapters/tests.ts";
import { prefixTable, settings } from "../domain/config.ts";
import type { Inputs } from "../domain/model.ts";

export function load(root: string, configFile: string | undefined): Inputs {
  const folder = new Folder(root);
  const name = configFile ?? "spec-trace.json";
  const text = folder.optional(name);
  if (configFile && text === undefined) throw new Error(`${configFile} does not exist`);
  const { config, prefixFile } = settings(text === undefined ? {} : JSON.parse(text), name);
  if (prefixFile) {
    const table = folder.optional(prefixFile);
    if (table === undefined) throw new Error(`${name}: the prefix file ${prefixFile} does not exist`);
    config.prefixes = prefixTable(table, prefixFile);
  }
  const features = folder.match(config.features).map((file) => parseFeature(file, folder.read(file)));
  return {
    config,
    files: folder.files,
    scenarios: features.flatMap((feature) => feature.scenarios),
    errors: features.flatMap((feature) => feature.errors),
    tests: folder.match(config.tests).flatMap((file) => readTests(file, folder.read(file), config.function)),
    results: readResults(join(root, config.junit), config.id),
  };
}
