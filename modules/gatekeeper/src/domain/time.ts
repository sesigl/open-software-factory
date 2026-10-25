// Times as microseconds since 1970: Slack's message times have six digits after the second.
import { UsageError } from "@opensoftware/cli";

export function fromIso(text: string): number {
  const match = /^(.*T\d\d:\d\d:\d\d)(?:\.(\d{1,6}))?(Z|[+-]\d\d:\d\d)$/.exec(text);
  const millis = match ? Date.parse(`${match[1]}${match[3]}`) : Number.NaN;
  if (!match || Number.isNaN(millis)) throw new UsageError(`${text} is not a time like 2026-01-01T05:00:00Z`);
  return millis * 1000 + Number((match[2] ?? "").padEnd(6, "0"));
}

export function toIso(micros: number): string {
  const seconds = Math.floor(micros / 1_000_000);
  const fraction = String(micros % 1_000_000).padStart(6, "0");
  return `${new Date(seconds * 1000).toISOString().slice(0, 19)}.${fraction}Z`;
}

const UNITS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86_400 };

/** A duration like "30m", "4h" or "2d", in microseconds. */
export function duration(text: unknown, rule: string): number {
  const match = typeof text === "string" ? /^([1-9]\d*)([smhd])$/.exec(text) : null;
  if (!match) throw new UsageError(`the policy's ${rule} must be a duration like "30m", "4h" or "2d"`);
  return Number(match[1]) * (UNITS[match[2] as string] as number) * 1_000_000;
}
