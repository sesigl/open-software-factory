// check <repo> <sha> <name> <state> [--description <text>] [--url <url>]: a commit status named after the check.
import { check as ensure, type Outcome } from "@opensoftware/cli";
import { CHECK_STATES } from "../domain/repository.ts";
import { forge, line } from "./forge.ts";

export interface CheckOptions {
  description?: string;
  url?: string;
}

export async function check(
  repo: string | undefined,
  sha: string | undefined,
  name: string | undefined,
  state: string | undefined,
  options: CheckOptions,
): Promise<Outcome> {
  const api = forge(repo);
  ensure(sha && name, "name the commit and the check, like check tester/web 9b1c2d3 verify success");
  ensure(CHECK_STATES.includes(state ?? ""), `the state is one of ${CHECK_STATES.join(", ")}`);
  await api.call("POST", `/statuses/${sha}`, {
    context: name,
    state,
    description: options.description ?? "",
    target_url: options.url ?? "",
  });
  return line({ name, state });
}
