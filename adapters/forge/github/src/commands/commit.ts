// commit <repo> <branch> --message <text> <path>=<file>...: one commit with these files on top of the branch's head,
// through GitHub's Git Data API (a blob of each file's bytes, a tree of them on the head's tree, a commit, and the
// branch moved without force; ADR 0136).
import { readFileSync } from "node:fs";
import { check, type Outcome } from "@opensoftware/cli";
import { GitHubError } from "../adapters/github.ts";
import { connect, headRef, print } from "./shared.ts";

/** The files of the command line: each `<path in the repository>=<local file>`, with the local file's bytes. */
function filesOf(pairs: string[]): { path: string; content: Buffer }[] {
  check(pairs.length > 0, "name the files, like commit tester/web fix --message 'Fix' factory.yaml=./factory.yaml");
  return pairs.map((pair) => {
    const at = pair.indexOf("=");
    check(at > 0, `name each file as <path>=<local file>, not ${pair}`);
    return { path: pair.slice(0, at), content: readFileSync(pair.slice(at + 1)) };
  });
}

export async function commit(
  repo: string | undefined,
  branch: string | undefined,
  message: string | undefined,
  pairs: string[],
): Promise<Outcome> {
  const api = connect(repo);
  check(branch, "name the branch, like commit tester/web fix --message 'Fix' factory.yaml=./factory.yaml");
  check(message, "give the commit a --message");
  const files = filesOf(pairs);
  const ref = headRef(branch as string);
  const head = await api
    .request<{ object: { sha: string } }>("GET", ref.replace("/git/refs/", "/git/ref/"))
    .catch((error: unknown) =>
      Promise.reject(
        error instanceof GitHubError && error.status === 404 ? new Error(`no branch ${repo}:${branch}`) : error,
      ),
    );
  const parent = head.object.sha;
  const { tree } = await api.request<{ tree: { sha: string } }>("GET", `/git/commits/${parent}`);
  // A blob in base64 keeps every byte; a tree entry's own content would be read as UTF-8 text.
  const entries = [];
  for (const { path, content } of files) {
    const blob = await api.request<{ sha: string }>("POST", "/git/blobs", {
      content: content.toString("base64"),
      encoding: "base64",
    });
    entries.push({ path, mode: "100644", type: "blob", sha: blob.sha });
  }
  const made = await api.request<{ sha: string }>("POST", "/git/trees", { base_tree: tree.sha, tree: entries });
  const created = await api.request<{ sha: string }>("POST", "/git/commits", {
    message,
    tree: made.sha,
    parents: [parent],
  });
  await api.request("PATCH", ref, { sha: created.sha, force: false });
  return print({ sha: created.sha });
}
