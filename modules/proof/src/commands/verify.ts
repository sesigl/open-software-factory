// proof verify: the manifest matches the contract, every artifact its checksum, every listed scenario passed.
import { type EvidenceManifest, validate } from "@opensoftware/contracts";
import { fingerprint, readManifest } from "../adapters/files.ts";
import { judge } from "../domain/verdict.ts";

/** The lines to print and whether any of them is a problem. */
export function verify(folder: string, required: string[]): { lines: string[]; ok: boolean } {
  const document = readManifest(folder);
  const invalid = validate("evidence-bundle", document);
  if (invalid.length > 0) {
    return { lines: invalid.map((problem) => `evidence.json ${problem.path}: ${problem.message}`), ok: false };
  }
  const manifest = document as EvidenceManifest;
  const damaged = manifest.artifacts.flatMap((artifact) => {
    const found = fingerprint(folder, artifact.path);
    if (!found) return [`${artifact.path} is missing`];
    return found.sha256 === artifact.sha256 ? [] : [`${artifact.path} does not match its SHA-256`];
  });
  const verdicts = judge(manifest, required);
  return {
    lines: [...verdicts.map((verdict) => verdict.line), ...damaged],
    ok: damaged.length === 0 && verdicts.every((verdict) => !verdict.problem),
  };
}
