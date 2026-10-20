// A Forgejo pull request with a bundle of its head commit, and the GitHub API routes attach calls.
import type { Fakes, Forge, PullRequest, Sut } from "@opensoftware/testkit";
import { bundleOf, type PlaywrightTest, SHA } from "./reports.ts";

/** A Forgejo with the repository "web" and a pull request; $INPUT/evidence is a bundle of its head commit. */
export async function forgejoBundle(
  sut: Sut,
  fakes: Fakes,
  tests: PlaywrightTest[],
): Promise<{ forge: Forge; pr: PullRequest; env: Record<string, string> }> {
  const forge = await fakes.forge();
  await forge.createRepository("web");
  const pr = await forge.openPullRequest("web", {
    branch: "checkout",
    title: "Pay with a card",
    files: { "checkout.ts": "export const pay = () => true;\n" },
  });
  await bundleOf(sut, tests, { commit: pr.sha, pullRequest: pr.url });
  return { forge, pr, env: { PROOF_FORGE_URL: forge.url, PROOF_FORGE_TOKEN: forge.token } };
}

/** The GitHub API routes of one attach to acme/web#7 at SHA, after the comment list `comments`. */
export function githubRoutes(comments: { id: number; body: string }[]) {
  return [
    { path: "/repos/acme/web/issues/7/comments?per_page=100&page=1", body: comments },
    { method: "POST", path: "/repos/acme/web/issues/7/comments", status: 201, body: { id: 43 } },
    { method: "PATCH", path: "/repos/acme/web/issues/comments/42", body: { id: 42 } },
    { method: "POST", path: `/repos/acme/web/statuses/${SHA}`, status: 201, body: { id: 1 } },
  ];
}
