// "factory diff <old> [new]": the changes between two versions of factory.yaml, as files or Git revisions.
import { parse } from "yaml";
import { exists, readText } from "../adapters/files.ts";
import { showRevision } from "../adapters/git.ts";
import { diff } from "../domain/diff.ts";

const version = (source: string): unknown => parse(exists(source) ? readText(source) : showRevision(source));

export function diffVersions(old: string, now: string): string[] {
  const lines = diff(version(old), version(now));
  return lines.length > 0 ? lines : ["No changes."];
}
