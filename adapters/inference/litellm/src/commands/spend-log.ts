// spend-log <ID>: one JSON line per call, LiteLLM's spend log rows as GET /spend/logs gives them, oldest first. An
// attached gateway shares its proxy with other clients, so its log has only the calls of the run keys it made.
import type { Outcome } from "@opensoftware/cli";
import { admin } from "../adapters/litellm.ts";
import { tokens } from "../adapters/records.ts";
import { flushWaitMs, LITELLM_BATCH_WRITE_AT, STARTED_BATCH_WRITE_AT } from "../domain/config.ts";
import { findGateway } from "./gateway.ts";

export async function spendLog(id: string | undefined): Promise<Outcome> {
  const gateway = await findGateway(id);
  // After the wait, every call answered before is written. The record of a gateway attached by a version before
  // osf.proxy.proxy_batch_write_at has no interval: LiteLLM's default.
  const record = gateway.record;
  const batchWriteAt = record ? (record.batchWriteAt ?? LITELLM_BATCH_WRITE_AT) : STARTED_BATCH_WRITE_AT;
  await new Promise((resolve) => setTimeout(resolve, flushWaitMs(batchWriteAt)));
  let rows = (await admin(gateway, "/spend/logs")) as { startTime: string; api_key: string }[];
  if (gateway.record) {
    const own = new Set(tokens(gateway.record.id));
    rows = rows.filter((row) => own.has(row.api_key));
  }
  rows.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return { lines: rows.map((row) => JSON.stringify(row)) };
}
