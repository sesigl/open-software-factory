// gatekeeper verify: check a record's signature with the public key.
import { readJson, readText } from "../adapters/files.ts";
import { type GateRecord, verifyRecord } from "../domain/record.ts";

export function verify(file: string, publicKey: string) {
  const record = readJson(file) as GateRecord;
  const problem = verifyRecord(record, readText(publicKey));
  if (problem) return { errors: [`${file}: ${problem}`], exitCode: 1 };
  const by = record.decidedBy ? ` by ${record.decidedBy.id}` : "";
  return { lines: [`${file} verified: ${record.decision}${by} at ${record.decidedAt}`] };
}
