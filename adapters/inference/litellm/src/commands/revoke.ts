// revoke <ID> <run ID>: deletes the run's key, so its calls get 401; its spend rows stay. A run without a key, or one
// revoked before, is no error, so a revoke can run again (ADR 0108).
import { check, type Outcome } from "@opensoftware/cli";
import { admin } from "../adapters/litellm.ts";
import { addRevoked, tokens } from "../adapters/records.ts";
import { runKeyValue } from "../domain/names.ts";
import { findGateway } from "./gateway.ts";

export async function revoke(id: string | undefined, run: string | undefined): Promise<Outcome> {
  check(run, "name the run, like revoke <ID> run-7");
  const gateway = await findGateway(id);
  // An attached gateway knows the tokens of its run keys; a gateway that start ran has only keys of its own.
  const keys = gateway.record ? tokens(gateway.record.id, run) : [runKeyValue(gateway.masterKey, id as string, run)];
  // LiteLLM answers 404 for a key that is gone.
  if (keys.length > 0) await admin(gateway, "/key/delete", { keys }, 404);
  if (gateway.record) addRevoked(gateway.record.id, run);
  return { lines: [] };
}
