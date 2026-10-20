// Evidence bundles of proof: the manifest evidence.json, checked against the evidence-bundle contract.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type EvidenceManifest, validate } from "@opensoftware/contracts";

/** The artifact count per scenario ID over every bundle. Throws when a manifest does not match the contract. */
export function readEvidence(folders: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const folder of folders) {
    const file = join(folder, "evidence.json");
    const manifest = JSON.parse(readFileSync(file, "utf8")) as EvidenceManifest;
    const [problem] = validate("evidence-bundle", manifest);
    if (problem)
      throw new Error(`${file} does not match the evidence-bundle contract: ${problem.path} ${problem.message}`);
    for (const scenario of manifest.scenarios) {
      counts.set(scenario.id, (counts.get(scenario.id) ?? 0) + scenario.artifacts.length);
    }
  }
  return counts;
}
