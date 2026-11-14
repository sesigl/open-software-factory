---
covers: [adapters/forge/github/src/**]
---

# forge-github

Branches, pull requests, checks, comments, merge rules, webhooks and pull request events on
[GitHub](https://github.com) or GitHub Enterprise Server, behind the factory's forge port. It calls GitHub's REST
API and keeps no state of its own. Decision: [ADR 0058](../../../docs/decisions/0058-forge-github.md). The port's
scenarios are in [`ports/forge/features/`](../../../ports/forge/features/forge.feature).

## Quick start

```sh
export FORGE_TOKEN=... FORGE_WEBHOOK_SECRET=...   # FORGE_URL defaults to https://api.github.com
npx @opensoftware/forge-github branch acme/web fix-checkout        # {"branch":"fix-checkout","sha":"0c4f..."}
# ... push commits to fix-checkout with git ...
npx @opensoftware/forge-github open-pr acme/web fix-checkout --title "Fix checkout button on Safari"
npx @opensoftware/forge-github check acme/web 0c4f... verify success --description "14 scenarios passed"
npx @opensoftware/forge-github protect acme/web main --check verify --approvals 1
npx @opensoftware/forge-github merge acme/web 7 --method squash   # {"sha":"3449..."}
npx @opensoftware/forge-github webhook acme/web https://intake.example/forge
npx @opensoftware/forge-github event delivery.json                # a pr.opened@v1 CloudEvent
```

## How it behaves

- **The token** is sent as a bearer token with the API version `2022-11-28`. It needs write access to contents, pull
  requests and commit statuses, read access to checks (`Checks: read`), and administration of the repository for `protect` and `webhook`; `rules` reads the branch protection, which needs `Administration: read`. A token GitHub
  refuses exits 1 with `the forge refused the token`; a repository it does not show exits 1 with
  `no repository <repo>`.
- **Usage errors** exit 2 before any call to GitHub: a repository that is not `<owner>/<name>`, a pull request
  number that is not a whole number above 0, and a command with a word too many, which prints the usage.
- **Comments.** `comments` marks the token's own comments as `mine` with its user from `GET /user`. GitHub refuses
  that call for a GitHub Actions token; its user is then `github-actions[bot]`, who writes its comments.
- **Branches** are refs: `branch` creates `refs/heads/<branch>` at the commit of `--from` or of the default branch.
- **Checks** are the commit statuses and the check runs of the head commit, one per name
  ([ADR 0104](../../../docs/decisions/0104-forge-github-check-runs.md)). A job of GitHub Actions is a check run.
  `check` writes a commit status. `pr` lists the latest status per name from the combined status, and reads every
  page of check runs, 100 per page. A check run is `pending` until it completed; then `success` for the conclusions
  `success`, `neutral` and `skipped` (GitHub's branch protection counts them as passing), `failure` for `failure`,
  and `error` for any other (`timed_out`, `cancelled`, `action_required`, `stale`, `startup_failure`). Of several
  check runs with one name, as after a re-run, the newest counts. Of a status and a check run with one name, the
  worse state counts, in the order `success`, `pending`, `failure`, `error`. A check run's description is its
  output's title, and its URL its page on GitHub. A token that may not read check runs makes `pr` exit 1 with
  `the token may not read the check runs of <repo>: give it the permission "Checks: read"`.
- **Merge state.** GitHub computes whether a new pull request can merge in the background and answers
  `mergeable: null` until it knows. `pr` asks again for up to 10 seconds. `mergeCommit` is set only once the pull
  request is merged; GitHub's test merge of an open pull request is not printed.
- **Merge rules** are the branch protection: the required status checks, the number of required approving
  reviews, and `enforce_admins`, so that the rules also hold for an admin's token. `protect` replaces the whole
  protection each time. `rules` reads the branch protection back; a branch without one requires nothing. It does
  not read rulesets yet.
- **Merge.** When GitHub refuses, `merge` exits 1 with `the forge refused to merge #<number>: <GitHub's reason>`,
  for example `Required status check "verify" is failing.`; a pull request that conflicts with its base gives
  `it conflicts with its base`.
- **Merge when green** is GitHub's auto-merge (ADR 0136), as `gh pr merge --auto` uses it. `merge --when-green`
  waits as `pr` does until GitHub knows whether the pull request can merge, then reads its `mergeStateStatus` with
  GitHub's GraphQL API (`/graphql`, or `/api/graphql` beside GitHub Enterprise Server's `/api/v3`). A pull request
  that GitHub would merge now (`CLEAN`, `HAS_HOOKS`, `UNSTABLE`), or one with a conflict, gets the plain merge;
  any other enables auto-merge with the merge method (GraphQL `enablePullRequestAutoMerge`) and prints
  `{"queued": true}`. A pull request whose `autoMergeRequest` is set already prints `{"queued": true}` without a
  second request. GitHub merges it as the token's user once the required checks and reviews pass. Auto-merge
  needs the repository's setting "Allow auto-merge", which a new repository has off and which GitHub offers for
  private repositories only on its paid plans; without it the command exits 1 with
  `the forge cannot merge <repo>#<number> when its checks pass: allow auto-merge in the repository's settings`.
- **Commit** uses the Git Data API: a tree with the files' text on the tree of the branch's head, a commit with the
  head as its parent, and the branch moved there without force, so a branch that moved in between is not
  overwritten: GitHub answers `Update is not a fast forward`.
- **Close** sets the pull request's state to `closed`; with `--delete-branch` it then deletes the head branch's ref.
- **Webhooks** are repository webhooks with JSON content, the events of `--event` or else `pull_request`,
  `pull_request_review` and `issue_comment`, and the secret `FORGE_WEBHOOK_SECRET`. A second `webhook` for the same
  URL updates that webhook and replaces its events.
- **Events.** `event` reads `{"headers": {...}, "body": "<the body as it arrived>"}`. With `FORGE_WEBHOOK_SECRET`
  set, `X-Hub-Signature-256` must be `sha256=` and the HMAC-SHA256 of the body. The type comes from
  `X-GitHub-Event`: `pull_request` with the action `opened` is `pr.opened@v1`, with `closed` it is `pr.closed@v1`;
  `pull_request_review` with `submitted` is `pr.reviewed@v1` with `approved`, `changes_requested` or `commented`.
  The CloudEvent's `id` is `X-GitHub-Delivery`, and a person is `github:<login>`. Any other delivery, such as a
  `ping` or a comment, prints nothing.

## Commands

`--event` takes the port's names (ADR 0060) and maps them to GitHub's events: `issue` and `issue.<action>` are
`issues`, and an action never changes the event, so `pull_request.labeled` is `pull_request`.

| Command | What it does |
| --- | --- |
| `forge-github branch <repo> <branch> [--from <ref>]` | Create a branch from the default branch or the ref, a branch or a commit; print `{"branch", "sha"}`. |
| `forge-github commit <repo> <branch> --message <text> <path>=<file>...` | Write one commit with these files, the contents of the local files, on top of the branch's head; print `{"sha"}`. |
| `forge-github open-pr <repo> <head> --title <text> [--body <text>] [--base <branch>]` | Open a pull request; print `{"number", "url", "head", "base", "sha"}`. |
| `forge-github pr <repo> <number>` | Print the pull request's state, `mergeable`, head and merge commit, author, labels, draft, first 100 changed paths, and checks. |
| `forge-github prs <repo> [--head <prefix>] [--state open\|closed\|all] [--limit <n>]` | Print each pull request whose branch starts with the prefix, the highest number first and at most n, reading only the pages of the newest it needs, as `{"number", "url", "title", "state", "head", "base", "author", "created", "draft", "review"}`, a merged one with its `mergeCommit`; `review` is `approved`, `changes_requested` or `none` (ADR 0073). |
| `forge-github check <repo> <sha> <name> <pending\|success\|failure\|error> [--description <text>] [--url <url>]` | Post a check on a commit. |
| `forge-github comment <repo> <number> <text>` | Comment on a pull request; print `{"id", "url"}`. |
| `forge-github comments <repo> <number>` | Print the first 100 comments of the conversation, oldest first, as `{"id", "url", "author", "time", "text", "mine"}`. |
| `forge-github protect <repo> <branch> [--check <name>]... [--approvals <n>]` | Replace the branch's protection. |
| `forge-github rules <repo> <branch>` | Print the checks and approvals the branch requires as `{"checks", "approvals"}`. |
| `forge-github close <repo> <number> [--delete-branch]` | Close a pull request without merging, and delete its branch; print `{"number", "state"}`. |
| `forge-github merge <repo> <number> [--method merge\|squash\|rebase] [--when-green]` | Merge; print `{"sha"}` of the merge commit. With `--when-green`, ask the forge to merge once the required checks pass, and print `{"queued": true}`, unless it can merge now. |
| `forge-github webhook <repo> <url> [--event <name>]...` | Register one webhook for the port's events, by default pull requests; print `{"id", "url", "events", "active"}`. |
| `forge-github hooks <repo>` | Print each webhook of the repository as `{"id", "url", "events", "active"}`. |
| `forge-github unhook <repo> <id>` | Remove a webhook; print `{"id", "removed"}`, with `removed` false when it had none. |
| `forge-github event <delivery.json>` | Print the delivery's pull request or issue label CloudEvent, or nothing. |

## Tests

The system tests run the port's `@conformance` scenarios and this adapter's own scenarios in
[`features/`](features/github.feature) against `fakes.github()`, the testkit's in-process fake of
GitHub's REST API (ADR 0058). No real GitHub is called.

## Releases

release-please opens a release pull request from the Conventional Commits under `adapters/forge/github/`. Merging it
creates the tag `forge-github-v<version>`. The workflow `.github/workflows/publish-forge-github.yml` then builds the
package and publishes it to npm as `@opensoftware/forge-github`. The first release is `0.1.0`; until `1.0.0`, a
breaking change raises the minor version. The one-time setup is the same as for contracts
([`contracts/README.md`](../../../contracts/README.md#releases)). No credential is stored in the repository.

## Configuration

<!-- generated by make docs from src/config.schema.json: do not edit -->

| Variable | Type | Default | Meaning |
| --- | --- | --- | --- |
| `FORGE_URL` | string | `"https://api.github.com"` | The base URL of GitHub's REST API; for GitHub Enterprise Server https://<host>/api/v3. |
| `FORGE_TOKEN` | string |  | A GitHub token that may write contents, pull requests, commit statuses and the repository's administration (branch protection, webhooks), and read checks (Checks: read) for the check runs that pr lists. Required by every command but event. |
| `FORGE_WEBHOOK_SECRET` | string |  | The secret of the webhooks that webhook registers. When it is set, event refuses a delivery whose X-Hub-Signature-256 does not match. |
