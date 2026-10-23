// The files an adapter reads before it starts a sandbox: the spec, and whether a secret's file exists. The library
// never reads a secret's value.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { UsageError } from "@opensoftware/cli";
import { type SandboxSpec, validate } from "@opensoftware/contracts";
import { type Secret, secretsOf } from "./domain/secrets.ts";

/** The sandbox spec in the file; a document that is no sandbox spec is a usage error that names each problem. */
export function readSpec(file: string): SandboxSpec {
  const document: unknown = JSON.parse(readFileSync(file, "utf8"));
  const problems = validate("sandbox-spec", document);
  if (problems.length) {
    throw new UsageError(problems.map((problem) => `${file}: ${problem.path} ${problem.message}`).join("\n"));
  }
  return document as SandboxSpec;
}

/**
 * The spec's secrets and where each comes from. A reference that cannot be resolved is a usage error, before the
 * adapter starts anything.
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
