// Hash-based sampling: the same run is always in or out for a scorer and a seed (ADR 0032).
import { createHash } from "node:crypto";

export function isSampled(seed: string, scorer: string, run: string, rate: number): boolean {
  const hash = createHash("sha256").update(`${seed}:${scorer}:${run}`).digest();
  return hash.readUInt32BE(0) / 2 ** 32 < rate;
}
