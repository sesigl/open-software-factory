// commit <repo> <branch> --message <text> <path>=<file>...: one commit with these files on top of the branch's head,
// through Forgejo's API that changes several files at once (ADR 0136).
import { readFileSync } from "node:fs";
import { check, type Outcome } from "@opensoftware/cli";
import { found } from "../adapters/forgejo.ts";
import { forge, line } from "./forge.ts";

export async function commit(
  repo: string | undefined,
  branch: string | undefined,
  message: string | undefined,
  pairs: string[],
): Promise<Outcome> {
  const api = forge(repo);
  check(branch, "name the branch, like commit tester/web fix --message 'Fix' factory.yaml=./factory.yaml");
  check(message, "give the commit a --message");
  check(pairs.length > 0, "name the files, like commit tester/web fix --message 'Fix' factory.yaml=./factory.yaml");
  for (const pair of pairs) check(pair.indexOf("=") > 0, `name each file as <path>=<local file>, not ${pair}`);
  const name = encodeURIComponent(branch as string);
  if (!(await found(api.call("GET", `/branches/${name}`)))) throw new Error(`no branch ${repo}:${branch}`);
  // Forgejo updates a file that the branch has by its blob's SHA, and creates any other.
  const changes = await Promise.all(
    pairs.map(async (pair) => {
      const path = pair.slice(0, pair.indexOf("="));
      const base64 = readFileSync(pair.slice(path.length + 1)).toString("base64");
      const at = `/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${name}`;
      const existing = await api.call<{ sha: string }>("GET", at).catch(() => undefined);
      return existing
        ? { operation: "update", path, content: base64, sha: existing.sha }
        : { operation: "create", path, content: base64 };
    }),
  );
  const answer = await api.call<{ commit: { sha: string } }>("POST", "/contents", {
    branch,
    message,
    files: changes,
  });
  return line({ sha: answer.commit.sha });
}
