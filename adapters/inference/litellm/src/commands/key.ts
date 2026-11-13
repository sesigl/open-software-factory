// key <ID> <run ID> [--budget <USD>]: a LiteLLM virtual key for one run. Its spend rows name the run, and LiteLLM
// refuses its calls once the run's spend passed the budget. The key is the same for the same run: its value comes from
// the gateway's master key, and LiteLLM refuses a second key with the run's alias, so the run keeps its spend and the
// budget of its first key (ADR 0108).
import { check, type Outcome } from "@opensoftware/cli";
import { admin } from "../adapters/litellm.ts";
import { addToken } from "../adapters/records.ts";
import { runKeyAlias, runKeyValue } from "../domain/names.ts";
import { findGateway } from "./gateway.ts";

export async function key(id: string | undefined, run: string | undefined, budget?: string): Promise<Outcome> {
  check(run, "name the run, like key <ID> run-7");
  const maxBudget = budget === undefined ? undefined : Number(budget);
  check(maxBudget === undefined || maxBudget >= 0, "--budget takes an amount in USD, like --budget 2.5");
  const gateway = await findGateway(id);
  const value = runKeyValue(gateway.masterKey, id as string, run);
  const metadata = { spend_logs_metadata: { "osf.run.id": run } };
  const body = { key: value, key_alias: runKeyAlias(id as string, run), max_budget: maxBudget, metadata };
  const created = (await admin(gateway, "/key/generate", body, 400)) as {
    key: string;
    token: string;
    error?: { message: string; param?: string };
  };
  if (created.error) {
    // LiteLLM's answer when a key with the alias exists: the run has its key already.
    if (created.error.param !== "key_alias")
      throw new Error(`LiteLLM answered /key/generate with 400: ${created.error.message}`);
    return { lines: [value] };
  }
  if (gateway.record) addToken(gateway.record.id, created.token, run);
  return { lines: [created.key] };
}
