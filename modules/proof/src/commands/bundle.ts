// proof bundle: joins the tests of Playwright and JUnit reports by scenario ID into one evidence bundle.
import { validate } from "@opensoftware/contracts";
import { fingerprint, mustExist, writeFiles, writeManifest } from "../adapters/files.ts";
import { headCommit } from "../adapters/git.ts";
import { junitReport } from "../adapters/junit.ts";
import { playwrightTests } from "../adapters/playwright.ts";
import { manifest, plan, type Subject } from "../domain/evidence.ts";

export interface BundleOptions {
  playwright: string[];
  junit: string[];
  out: string;
  repository: string | undefined;
  commit: string | undefined;
  pullRequest: string | undefined;
  version: string;
  now: string;
  /** Receives one line per test without a scenario ID. */
  warn: (line: string) => void;
}

export function bundle(options: BundleOptions): string {
  if (!options.repository) {
    throw new Error("give the repository with --repository, or run in GitHub Actions");
  }
  mustExist([...options.playwright, ...options.junit]);
  const planned = plan(options.playwright.flatMap(playwrightTests), options.junit.map(junitReport));
  mustExist(planned.copies.map((copy) => copy.source));
  for (const title of planned.unnamed) options.warn(`no scenario ID: ${title}`);

  writeFiles(options.out, planned.copies);
  const artifacts = planned.copies.map((copy) => ({
    path: copy.path,
    kind: copy.kind,
    mediaType: copy.mediaType,
    ...(fingerprint(options.out, copy.path) as { sha256: string; bytes: number }),
  }));
  const subject: Subject = {
    repository: options.repository,
    commit: options.commit ?? headCommit(),
    ...(options.pullRequest ? { pullRequest: options.pullRequest } : {}),
  };
  const written = manifest(planned, artifacts, subject, { name: "proof", version: options.version }, options.now);
  const problems = validate("evidence-bundle", written);
  if (problems.length > 0) {
    throw new Error(problems.map((problem) => `evidence.json ${problem.path}: ${problem.message}`).join("\n"));
  }
  const file = writeManifest(options.out, written);
  return `wrote ${file}: ${written.result}, ${written.scenarios.length} scenarios, ${artifacts.length} artifacts`;
}
