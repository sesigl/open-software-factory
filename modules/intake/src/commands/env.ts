// The variables of a command: a missing one is a usage error that names it and says what it is for.
import { UsageError } from "@opensoftware/cli";

export type Env = Record<string, string | undefined>;

export function required(env: Env, name: string, what: string): string {
  const value = env[name];
  if (!value) throw new UsageError(`set ${name}: ${what}`);
  return value;
}
