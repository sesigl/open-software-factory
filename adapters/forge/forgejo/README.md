---
covers: [adapters/forge/forgejo/src/**]
---

# forge-forgejo

Branches, pull requests, checks, comments, merge rules, webhooks and pull request events on a
[Forgejo](https://forgejo.org) forge, such as Codeberg or your own, behind the factory's forge port. It calls
Forgejo's REST API v1 and keeps no state of its own. Decision: [ADR 0057](../../../docs/decisions/0057-forge-port.md).
The port's scenarios are in [`ports/forge/features/`](../../../ports/forge/features/forge.feature).

## Quick start

```sh
export FORGE_URL=https://codeberg.org FORGE_TOKEN=... FORGE_WEBHOOK_SECRET=...
npx @opensoftware/forge-forgejo branch acme/web fix-checkout        # {"branch":"fix-checkout","sha":"0c4f..."}
# ... push commits to fix-checkout with git ...
npx @opensoftware/forge-forgejo open-pr acme/web fix-checkout --title "Fix checkout button on Safari"
npx @opensoftware/forge-forgejo check acme/web 0c4f... verify success --description "14 scenarios passed"
npx @opensoftware/forge-forgejo protect acme/web main --check verify --approvals 1
npx @opensoftware/forge-forgejo merge acme/web 7 --method squash   # {"sha":"3449..."}
npx @opensoftware/forge-forgejo webhook acme/web https://intake.example/forge
npx @opensoftware/forge-forgejo event delivery.json                # a pr.opened@v1 CloudEvent
```

## How it behaves

- **The token** needs the scopes `write:repository` and `write:issue`. A token Forgejo refuses exits 1 with
  `the forge refused the token`; a repository it does not have exits 1 with `no repository <repo>`.
- **Checks** are commit statuses with the check's name as their context. `pr` lists the latest status per name.
- **Merge rules** are one branch protection rule named after the branch: the required status checks and the number
  of approvals. `protect` replaces the rule's checks and approvals each time.
- **Merge state.** Forgejo checks whether a new pull request can merge in the background and reports it as not
  mergeable until it knows. `pr` waits up to 10 seconds for an open pull request to become mergeable, so a pull
  request that conflicts with its base takes 10 seconds to read.
- **Merge.** Forgejo answers "Please try again later" while it checks, and also for a pull request that conflicts with
  its base; `merge` tries again for up to 10 seconds and then exits 1 with `the forge refused to merge #<number>: it
  conflicts with its base, or the forge is still checking it`. When the merge rules refuse it, `merge` exits 1 with
  `the forge refused to merge #<number>: <Forgejo's reason>`.
- **Webhooks** are of type `forgejo` with JSON content, the events of `--event` or else `pull_request`,
  `pull_request_review_approved`, `pull_request_review_rejected` and `pull_request_review_comment`, and the secret
  `FORGE_WEBHOOK_SECRET`. A second `webhook` for the same URL updates that webhook and replaces its events.
- **Events.** `event` reads `{"headers": {...}, "body": "<the body as it arrived>"}`. With `FORGE_WEBHOOK_SECRET`
  set, `X-Forgejo-Signature` must be the HMAC-SHA256 of the body. The event type comes from `X-Forgejo-Event-Type`:
  `pull_request` with the action `opened` is `pr.opened@v1`, with `closed` it is `pr.closed@v1`; the three review
  types are `pr.reviewed@v1` with `approved`, `changes_requested` or `commented`. The CloudEvent's `id` is
  `X-Forgejo-Delivery`, and a person is `forgejo:<login>`. Any other delivery prints nothing.

## Commands

`--event` takes the port's names (ADR 0060) and maps them to Forgejo's events: `issue` is `issues`, `issue.labeled`
is `issue_label`, `pull_request.labeled` is `pull_request_label`, and `pull_request_review` is the three review events.
Forgejo answers `pull_request` with all of its pull request events.

| Command | What it does |
| --- | --- |
| `forge-forgejo branch <repo> <branch> [--from <ref>]` | Create a branch from the default branch or the ref; print `{"branch", "sha"}`. |
| `forge-forgejo open-pr <repo> <head> --title <text> [--body <text>] [--base <branch>]` | Open a pull request; print `{"number", "url", "head", "base", "sha"}`. |
| `forge-forgejo pr <repo> <number>` | Print the pull request's state, `mergeable`, head and merge commit, and checks. |
| `forge-forgejo check <repo> <sha> <name> <pending\|success\|failure\|error> [--description <text>] [--url <url>]` | Post a check on a commit. |
| `forge-forgejo comment <repo> <number> <text>` | Comment on a pull request; print `{"id", "url"}`. |
| `forge-forgejo protect <repo> <branch> [--check <name>]... [--approvals <n>]` | Set the branch's merge rules. |
| `forge-forgejo merge <repo> <number> [--method merge\|squash\|rebase]` | Merge; print `{"sha"}` of the merge commit. |
| `forge-forgejo webhook <repo> <url> [--event <name>]...` | Register one webhook for the port's events, by default pull requests; print `{"id", "url", "events", "active"}`. |
| `forge-forgejo hooks <repo>` | Print each webhook of the repository as `{"id", "url", "events", "active"}`. |
| `forge-forgejo unhook <repo> <id>` | Remove a webhook; print `{"id", "removed"}`, with `removed` false when it had none. |
| `forge-forgejo event <delivery.json>` | Print the delivery's pull request CloudEvent, or nothing. |

## Releases

release-please opens a release pull request from the Conventional Commits under `adapters/forge/forgejo/`. Merging
it creates the tag `forge-forgejo-v<version>`. The workflow `.github/workflows/publish-forge-forgejo.yml` then
builds the package and publishes it to npm as `@opensoftware/forge-forgejo`. The first release is `0.1.0`; until
`1.0.0`, a breaking change raises the minor version. The one-time setup is the same as for contracts
([`contracts/README.md`](../../../contracts/README.md#releases)). No credential is stored in the repository.

## Configuration

<!-- generated by make docs from src/config.schema.json: do not edit -->

| Variable | Type | Default | Meaning |
| --- | --- | --- | --- |
| `FORGE_URL` | string |  | The Forgejo's base URL, for example https://codeberg.org. Required by every command but event. |
| `FORGE_TOKEN` | string |  | A Forgejo API token with the scopes write:repository and write:issue. Required by every command but event. |
| `FORGE_WEBHOOK_SECRET` | string |  | The secret of the webhooks that webhook registers. When it is set, event refuses a delivery whose X-Forgejo-Signature does not match. |
