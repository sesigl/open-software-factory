// key <ID> <run ID> [--budget <USD>]: a LiteLLM virtual key for one run. Its spend rows name the run, and LiteLLM
// refuses its calls once the run's spend passed the budget.
import { check, type Outcome } from "@opensoftware/cli";
import { admin } from "../adapters/litellm.ts";
import { findGateway } from "./gateway.ts";

export async function key(id: string | undefined, run: string | undefined, budget?: string): Promise<Outcome> {
  check(run, "name the run, like key <ID> run-7");
  const maxBudget = budget === undefined ? undefined : Number(budget);
  check(maxBudget === undefined || maxBudget >= 0, "--budget takes an amount in USD, like --budget 2.5");
  const gateway = await findGateway(id);
  const metadata = { spend_logs_metadata: { "osf.run.id": run } };
  const created = (await admin(gateway, "/key/generate", { max_budget: maxBudget, metadata })) as { key: string };
  return { lines: [created.key] };
}
