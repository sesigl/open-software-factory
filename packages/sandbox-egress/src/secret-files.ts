// Whether each of the spec's secrets can be resolved, before the adapter starts anything: a secret's file must exist.
// The library never reads a secret's value.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { UsageError } from "@opensoftware/cli";
import type { SandboxSpec } from "@opensoftware/contracts";
import { type Secret, secretsOf } from "./domain/secrets.ts";

/**
 * The spec's secrets and where the egress proxy reads each from. A reference that cannot be resolved is a usage
 * error, before the adapter starts anything.
 */
export function resolveSecrets(
  spec: SandboxSpec,
  secretsDir: string,
  env: Record<string, string | undefined> = process.env,
): Secret[] {
  const { secrets, problems } = secretsOf(spec, {
    env,
    secretsDir,
    exists: (name) => existsSync(join(secretsDir, name)),
  });
  if (problems.length) throw new UsageError(problems.join("\n"));
  return secrets;
}
