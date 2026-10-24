// protect <repo> <branch> [--check <name>]... [--approvals <n>]: the merge rules of a branch, as one branch
// protection rule named after it.
import { check, type Outcome } from "@opensoftware/cli";
import { ForgeError } from "../adapters/forgejo.ts";
import { forge, line } from "./forge.ts";

export async function protect(
  repo: string | undefined,
  branch: string | undefined,
  checks: string[],
  approvals = "0",
): Promise<Outcome> {
  const api = forge(repo);
  check(branch, "name the branch, like protect tester/web main --check verify");
  const required = Number(approvals);
  check(Number.isInteger(required) && required >= 0, "--approvals takes a number, like --approvals 1");
  const rule = { enable_status_check: checks.length > 0, status_check_contexts: checks, required_approvals: required };
  const path = `/branch_protections/${encodeURIComponent(branch)}`;
  const exists = await api.call("GET", path).then(
    () => true,
    (error: unknown) => {
      if (error instanceof ForgeError && error.status === 404) return false;
      throw error;
    },
  );
  if (exists) await api.call("PATCH", path, rule);
  else await api.call("POST", "/branch_protections", { rule_name: branch, ...rule });
  return line({ branch, checks, approvals: required });
}
