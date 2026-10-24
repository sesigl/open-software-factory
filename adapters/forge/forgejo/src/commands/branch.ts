// branch <repo> <branch> [--from <ref>]: a branch from the default branch or a ref.
import { check, type Outcome } from "@opensoftware/cli";
import { ForgeError } from "../adapters/forgejo.ts";
import { defaultBranch, forge, line } from "./forge.ts";

export async function branch(repo: string | undefined, name: string | undefined, from?: string): Promise<Outcome> {
  const api = forge(repo);
  check(name, "name the branch, like branch tester/web fix-checkout");
  const created = await api
    .call<{ name: string; commit: { id: string } }>("POST", "/branches", {
      new_branch_name: name,
      old_ref_name: from ?? (await defaultBranch(api)),
    })
    .catch((error: unknown) => {
      throw error instanceof ForgeError && error.status === 409 ? new Error(`branch ${name} exists`) : error;
    });
  return line({ branch: created.name, sha: created.commit.id });
}
