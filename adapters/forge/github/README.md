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
  requests and commit statuses, and administration of the repository for `protect` and `webhook`. A token GitHub
  refuses exits 1 with `the forge refused the token`; a repository it does not show exits 1 with
  `no repository <repo>`.
- **Comments.** `comments` marks the token's own comments as `mine` with its user from `GET /user`. GitHub refuses
  that call for a GitHub Actions token; its user is then `github-actions[bot]`, who writes its comments.
- **Branches** are refs: `branch` creates `refs/heads/<branch>` at the commit of `--from` or of the default branch.
- **Checks** are commit statuses with the check's name as their context; GitHub Apps' check runs are not used.
  `pr` lists the latest status per name from the combined status of the head commit.
- **Merge state.** GitHub computes whether a new pull request can merge in the background and answers
  `mergeable: null` until it knows. `pr` asks again for up to 10 seconds. `mergeCommit` is set only once the pull
  request is merged; GitHub's test merge of an open pull request is not printed.
- **Merge rules** are the branch protection: the required status checks, the number of required approving
  reviews, and `enforce_admins`, so that the rules also hold for an admin's token. `protect` replaces the whole
  protection each time.
- **Merge.** When GitHub refuses, `merge` exits 1 with `the forge refused to merge #<number>: <GitHub's reason>`,
  for example `Required status check "verify" is failing.`; a pull request that conflicts with its base gives
  `it conflicts with its base`.
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
| `forge-github branch <repo> <branch> [--from <ref>]` | Create a branch from the default branch or the ref; print `{"branch", "sha"}`. |
| `forge-github open-pr <repo> <head> --title <text> [--body <text>] [--base <branch>]` | Open a pull request; print `{"number", "url", "head", "base", "sha"}`. |
| `forge-github pr <repo> <number>` | Print the pull request's state, `mergeable`, head and merge commit, author, labels, draft, first 100 changed paths, and checks. |
| `forge-github check <repo> <sha> <name> <pending\|success\|failure\|error> [--description <text>] [--url <url>]` | Post a check on a commit. |
| `forge-github comment <repo> <number> <text>` | Comment on a pull request; print `{"id", "url"}`. |
| `forge-github comments <repo> <number>` | Print the first 100 comments of the conversation, oldest first, as `{"id", "url", "author", "time", "text", "mine"}`. |
| `forge-github protect <repo> <branch> [--check <name>]... [--approvals <n>]` | Replace the branch's protection. |
| `forge-github merge <repo> <number> [--method merge\|squash\|rebase]` | Merge; print `{"sha"}` of the merge commit. |
| `forge-github webhook <repo> <url> [--event <name>]...` | Register one webhook for the port's events, by default pull requests; print `{"id", "url", "events", "active"}`. |
| `forge-github hooks <repo>` | Print each webhook of the repository as `{"id", "url", "events", "active"}`. |
| `forge-github unhook <repo> <id>` | Remove a webhook; print `{"id", "removed"}`, with `removed` false when it had none. |
| `forge-github event <delivery.json>` | Print the delivery's pull request or issue label CloudEvent, or nothing. |

## Tests

The system tests run the port's `@conformance` scenarios against `fakes.github()`, the testkit's in-process fake of
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
| `FORGE_TOKEN` | string |  | A GitHub token that may write contents, pull requests, commit statuses and the repository's administration (branch protection, webhooks). Required by every command but event. |
| `FORGE_WEBHOOK_SECRET` | string |  | The secret of the webhooks that webhook registers. When it is set, event refuses a delivery whose X-Hub-Signature-256 does not match. |
