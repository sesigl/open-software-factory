// rules <repo> <branch>: the checks and approvals that the branch protection rule named after the branch requires
// (ADR 0136); a branch without a rule requires nothing. It only reads: `protect` writes the rules.
import { check, type Outcome } from "@opensoftware/cli";
import { forge, line } from "./forge.ts";

interface Protection {
  rule_name?: string;
  branch_name?: string;
  enable_status_check: boolean;
  status_check_contexts: string[] | null;
  required_approvals: number;
}

export async function rules(repo: string | undefined, branch: string | undefined): Promise<Outcome> {
  const api = forge(repo);
  check(branch, "name the branch, like rules tester/web main");
  const all = await api.call<Protection[]>("GET", "/branch_protections");
  const rule = all.find((each) => (each.rule_name || each.branch_name) === branch);
  return line({
    checks: rule?.enable_status_check ? (rule.status_check_contexts ?? []) : [],
    approvals: rule?.required_approvals ?? 0,
  });
}
