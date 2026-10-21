// taskcapture route: report.json → a LiteLLM proxy config that sends the alias with the tag to the chosen model.
import { Document, parseDocument } from "yaml";
import { readText, writeFile } from "../adapters/files.ts";
import type { Report } from "../domain/cells.ts";
import { addRoute, type Choice, choose, routeLine } from "../domain/route.ts";

export function route(
  reportFile: string,
  options: Choice & { tag: string; alias: string; config: string | undefined; out: string },
): string[] {
  const cell = choose(JSON.parse(readText(reportFile)) as Report, options);
  const config = options.config ? parseDocument(readText(options.config)) : new Document({});
  if (config.errors.length) throw new Error(`${options.config} is not YAML: ${config.errors[0]?.message}`);
  addRoute(config, { alias: options.alias, tag: options.tag, model: cell.model });
  return [routeLine(options.tag, cell), `wrote ${writeFile(options.out, config.toString())}`];
}
