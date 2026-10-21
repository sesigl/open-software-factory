// scorekit scorers: one line per scorer of the pack with its sampling rate and description.
import { packNames, readScorer } from "../adapters/files.ts";

export function scorers(): string[] {
  const pack = packNames().map(readScorer);
  const width = Math.max(...pack.map((one) => one.name.length));
  return pack.map((one) => `${one.name.padEnd(width)}  ${String(one.sample).padEnd(4)}  ${one.description}`);
}
