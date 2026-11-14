// The variables of a command: a missing one is a usage error that names it and says what it is for.
import { UsageError } from "@opensoftware/cli";

export type Env = Record<string, string | undefined>;

export function required(env: Env, name: string, what: string): string {
  const value = env[name];
  if (!value) throw new UsageError(`set ${name}: ${what}`);
  return value;
}

const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

/** A duration like "7d", "12h", "30m" or "90s" in the variable, in milliseconds; undefined when it is not set. */
export function durationOf(env: Env, name: string): number | undefined {
  const value = env[name];
  if (!value) return undefined;
  const [, amount, unit] = /^([1-9]\d*)([smhd])$/.exec(value) ?? [];
  if (!amount) throw new UsageError(`${name} is "${value}": set a duration like 7d, 12h, 30m or 90s`);
  return Number(amount) * UNIT_MS[unit as keyof typeof UNIT_MS];
}
