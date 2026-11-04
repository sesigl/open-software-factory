// spend-log <ID>: one JSON line per call, LiteLLM's spend log rows as GET /spend/logs gives them, oldest first. An
// attached gateway shares its proxy with other clients, so its log has only the calls of the run keys it made.
import type { Outcome } from "@opensoftware/cli";
import { admin } from "../adapters/litellm.ts";
import { tokens } from "../adapters/records.ts";
import { findGateway } from "./gateway.ts";

/** LiteLLM writes spend rows every one to six seconds; after this wait, every call answered before is written. */
const FLUSH_WAIT_MS = 8_000;

export async function spendLog(id: string | undefined): Promise<Outcome> {
  const gateway = await findGateway(id);
  await new Promise((resolve) => setTimeout(resolve, FLUSH_WAIT_MS));
  let rows = (await admin(gateway, "/spend/logs")) as { startTime: string; api_key: string }[];
  if (gateway.record) {
    const own = new Set(tokens(gateway.record.id));
    rows = rows.filter((row) => own.has(row.api_key));
  }
  rows.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return { lines: rows.map((row) => JSON.stringify(row)) };
}
