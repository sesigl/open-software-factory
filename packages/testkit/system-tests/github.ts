// The client of the fakes.github scenarios: they call the fake in the test's process (ADR 0039), and a module would
// call GitHub's REST and GraphQL API the same way, with the URL and a token the fake gives.
import type { FakeGitHub } from "@opensoftware/testkit";

/** GitHub's answer: its HTTP status and the parsed body, undefined when the body is empty. */
// biome-ignore lint/suspicious/noExplicitAny: the scenarios read GitHub's JSON as a module would.
export interface GitHubAnswer<T = any> {
  status: number;
  json: T;
}

/**
 * Calls GitHub's REST API of the fake with a token, the owner's unless `token` names another, and gives the status
 * and the parsed answer without failing on an error status. With `repository`, a path is below
 * `/repos/<owner>/<repository>`; without, it is the whole path, like `/user`.
 */
export function githubClient(github: FakeGitHub, options: { repository?: string; token?: string } = {}) {
  const base = options.repository ? `/repos/${github.owner}/${options.repository}` : "";
  const token = options.token ?? github.token;
  return async (method: string, path: string, body?: unknown): Promise<GitHubAnswer> => {
    const response = await fetch(`${github.url}${base}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, json: text ? JSON.parse(text) : undefined };
  };
}

const PULL_REQUEST =
  "query($owner: String!, $name: String!, $number: Int!) { repository(owner: $owner, name: $name) { autoMergeAllowed pullRequest(number: $number) { id mergeStateStatus autoMergeRequest { enabledAt mergeMethod } } } }";
const ENABLE =
  "mutation($id: ID!, $method: PullRequestMergeMethod!) { enablePullRequestAutoMerge(input: { pullRequestId: $id, mergeMethod: $method }) { clientMutationId } }";

/**
 * The calls of auto-merge with GitHub's GraphQL API, as the owner: `state()` reads pull request 1 of `repository`
 * (its id, merge state and auto-merge request) and `enable(method)` enables its auto-merge and gives GitHub's answer.
 */
export function autoMerge(github: FakeGitHub, repository: string) {
  // biome-ignore lint/suspicious/noExplicitAny: the scenarios read GitHub's JSON as a module would.
  const graphql = async (query: string, variables: Record<string, unknown>): Promise<any> => {
    const response = await fetch(`${github.url}/graphql`, {
      method: "POST",
      headers: { authorization: `Bearer ${github.token}` },
      body: JSON.stringify({ query, variables }),
    });
    return response.json();
  };
  const state = async () =>
    (await graphql(PULL_REQUEST, { owner: github.owner, name: repository, number: 1 })).data.repository.pullRequest;
  return {
    state,
    enable: async (method: string) => graphql(ENABLE, { id: (await state()).id, method }),
  };
}

/** Requires the check "verify" on "main" of `repository`, for admins too, with no review. */
export async function requireVerify(github: FakeGitHub, repository: string): Promise<GitHubAnswer> {
  return githubClient(github, { repository })("PUT", "/branches/main/protection", {
    required_status_checks: { strict: false, contexts: ["verify"] },
    enforce_admins: true,
    required_pull_request_reviews: null,
    restrictions: null,
  });
}
