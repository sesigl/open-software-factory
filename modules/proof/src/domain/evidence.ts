// The domain layer: which test proves which scenario, where its files go in the bundle, and the manifest. No I/O.
import { createHash } from "node:crypto";
import type { EvidenceManifest } from "@opensoftware/contracts";

export type Result = "passed" | "failed" | "skipped";
export type Kind = EvidenceManifest["artifacts"][number]["kind"];
export type Subject = EvidenceManifest["subject"];

const SCENARIO_ID = /SCN-[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d{3}/g;

/** One file a test attached, at `source` on disk. */
export interface Attachment {
  source: string;
  kind: Kind;
  mediaType: string;
}

/** One test from a report: the scenario IDs it names, its result and the files that show it. */
export interface Test {
  title: string;
  ids: string[];
  result: Result;
  attachments: Attachment[];
}

/** One report that is itself evidence (JUnit) for the scenarios of its tests; its tests attach no files. */
export interface Report {
  source: string;
  tests: Omit<Test, "attachments">[];
}

/** One file to copy into the bundle. */
export interface Copy {
  source: string;
  path: string;
  kind: Kind;
  mediaType: string;
}

export interface Plan {
  copies: Copy[];
  scenarios: Map<string, { results: Result[]; artifacts: string[] }>;
  /** Titles of the tests that name no scenario ID. */
  unnamed: string[];
}

/** The scenario IDs in the texts, each once, in order. */
export function scenarioIds(...texts: string[]): string[] {
  return [...new Set(texts.flatMap((text) => text.match(SCENARIO_ID) ?? []))];
}

/** The artifact kind of a Playwright attachment. */
export function kindOf(name: string, mediaType: string): Kind {
  if (name === "trace") return "playwright-trace";
  if (mediaType.startsWith("image/")) return "screenshot";
  if (mediaType.startsWith("video/")) return "video";
  return "other";
}

/** Places every attachment and report in the bundle and collects the results per scenario. */
export function plan(tests: Test[], reports: Report[]): Plan {
  const copies: Copy[] = [];
  const scenarios: Plan["scenarios"] = new Map();
  const unnamed: string[] = [];
  const taken = new Set<string>();
  const place = (folder: string, source: string): string => {
    const file = source.split(/[\\/]/).pop() as string;
    const dot = file.lastIndexOf(".");
    const [stem, extension] = dot > 0 ? [file.slice(0, dot), file.slice(dot)] : [file, ""];
    let path = `${folder}/${file}`;
    for (let n = 2; taken.has(path); n++) path = `${folder}/${stem}-${n}${extension}`;
    taken.add(path);
    return path;
  };
  const record = (id: string, result: Result, paths: string[]): void => {
    const entry = scenarios.get(id) ?? { results: [], artifacts: [] };
    entry.results.push(result);
    for (const path of paths) if (!entry.artifacts.includes(path)) entry.artifacts.push(path);
    scenarios.set(id, entry);
  };

  for (const test of tests) {
    const [first] = test.ids;
    if (first === undefined) {
      unnamed.push(test.title);
      continue;
    }
    const paths = test.attachments.map((attachment) => {
      const path = place(`artifacts/${first}`, attachment.source);
      copies.push({ source: attachment.source, path, kind: attachment.kind, mediaType: attachment.mediaType });
      return path;
    });
    for (const id of test.ids) record(id, test.result, paths);
  }
  for (const report of reports) {
    const path = place("junit", report.source);
    copies.push({ source: report.source, path, kind: "junit", mediaType: "application/xml" });
    for (const test of report.tests) {
      if (test.ids.length === 0) unnamed.push(test.title);
      for (const id of test.ids) record(id, test.result, [path]);
    }
  }
  return { copies, scenarios, unnamed };
}

/** A scenario failed when any of its tests failed, was skipped when all were skipped, and passed otherwise. */
export function combine(results: Result[]): Result {
  if (results.includes("failed")) return "failed";
  return results.every((result) => result === "skipped") ? "skipped" : "passed";
}

/** The manifest of a bundle. Its ID hashes the subject and the evidence, so the same evidence gives the same ID. */
export function manifest(
  planned: Plan,
  artifacts: EvidenceManifest["artifacts"],
  subject: Subject,
  producer: EvidenceManifest["producer"],
  createdAt: string,
): EvidenceManifest {
  const scenarios = [...planned.scenarios]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, entry]) => ({ id, result: combine(entry.results), artifacts: entry.artifacts }));
  const result =
    scenarios.length > 0 && scenarios.every((scenario) => scenario.result === "passed") ? "passed" : "failed";
  const id = `proof-${createHash("sha256")
    .update(JSON.stringify({ subject, scenarios, artifacts }))
    .digest("hex")
    .slice(0, 26)}`;
  return { manifestVersion: 1, id, createdAt, subject, producer, result, scenarios, artifacts };
}
