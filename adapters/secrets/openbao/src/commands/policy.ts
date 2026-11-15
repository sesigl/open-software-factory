// policy write|read: prints one of the two policies for the mount, for `bao policy write <name> -` (ADR 0137).
import type { Outcome } from "@opensoftware/cli";
import { mountOf } from "../adapters/openbao.ts";
import { policyLines } from "../domain/policies.ts";

export function policy(which: string | undefined): Outcome {
  return { lines: policyLines(which, mountOf()) };
}
