// The forge API calls observer makes. GitHub and Forgejo answer them alike.
import type { PullRequestRef, RepositoryRef } from "../domain/forge-url.ts";

async function call<T>(api: string, token: string | undefined, method: string, path: string, body?: unknown) {
  const response = await fetch(api + path, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...(token && { authorization: `token ${token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`the forge answered ${response.status} to ${method} ${path}`);
  return (await response.json()) as T;
}

/** Opens a pull request and returns its URL. */
export async function openPullRequest(
  ref: RepositoryRef,
  token: string | undefined,
  pull: { title: string; body: string; head: string; base: string },
): Promise<string> {
  const answer = await call<{ html_url: string }>(
    ref.api,
    token,
    "POST",
    `/repos/${ref.owner}/${ref.repo}/pulls`,
    pull,
  );
  return answer.html_url;
}

/** When the pull request merged, or undefined when it did not. */
export async function mergedAt(ref: PullRequestRef, token: string | undefined): Promise<string | undefined> {
  const path = `/repos/${ref.owner}/${ref.repo}/pulls/${ref.number}`;
  return (await call<{ merged_at?: string | null }>(ref.api, token, "GET", path)).merged_at ?? undefined;
}

export async function comment(ref: PullRequestRef, token: string | undefined, body: string): Promise<void> {
  await call(ref.api, token, "POST", `/repos/${ref.owner}/${ref.repo}/issues/${ref.number}/comments`, { body });
}
