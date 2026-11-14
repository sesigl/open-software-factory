// merge <repo> <number> --when-green [--method merge|squash|rebase]: GitHub's auto-merge (ADR 0136). Like
// `gh pr merge --auto`, it merges at once a pull request that GitHub would merge now, and otherwise asks GitHub to
// merge it once its merge rules hold, through the GraphQL mutation enablePullRequestAutoMerge. A pull request whose
// auto-merge is on already is queued: a program that repeats itself sends no second request.
import { check, type Outcome } from "@opensoftware/cli";
import { MERGE_METHODS } from "../domain/repository.ts";
import { computed, merge } from "./pulls.ts";
import { connect, numberOf, print } from "./shared.ts";

/** The merge states in which GitHub merges now, as gh reads them; a conflict gets merge's own error. */
const MERGES_NOW = ["CLEAN", "HAS_HOOKS", "UNSTABLE", "DIRTY"];

const STATE = `query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    autoMergeAllowed
    pullRequest(number: $number) { id mergeStateStatus autoMergeRequest { enabledAt } }
  }
}`;
const ENABLE = `mutation($id: ID!, $method: PullRequestMergeMethod!) {
  enablePullRequestAutoMerge(input: { pullRequestId: $id, mergeMethod: $method }) { clientMutationId }
}`;

interface State {
  repository: {
    autoMergeAllowed: boolean;
    pullRequest: { id: string; mergeStateStatus: string; autoMergeRequest: { enabledAt: string } | null };
  };
}

export async function mergeWhenGreen(
  repo: string | undefined,
  number: string | undefined,
  method = "merge",
): Promise<Outcome> {
  const api = connect(repo);
  const issue = numberOf(number);
  check((MERGE_METHODS as readonly string[]).includes(method), `--method is one of ${MERGE_METHODS.join(", ")}`);
  // GitHub knows the merge state once it knows whether the pull request can merge; this also names a missing one.
  await computed(api, repo as string, issue);
  const [owner, name] = (repo as string).split("/");
  const { repository } = await api.graphql<State>(STATE, { owner, name, number: issue });
  if (MERGES_NOW.includes(repository.pullRequest.mergeStateStatus)) return merge(repo, number, method);
  if (repository.pullRequest.autoMergeRequest) return print({ queued: true });
  if (!repository.autoMergeAllowed)
    throw new Error(
      `the forge cannot merge ${repo}#${issue} when its checks pass: allow auto-merge in the repository's settings`,
    );
  await api.graphql(ENABLE, { id: repository.pullRequest.id, method: method.toUpperCase() });
  return print({ queued: true });
}
