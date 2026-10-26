---
covers: [ports/forge/**]
---

# forge port

How the factory works with the company's code forge: branches, pull requests, checks, comments, merge rules,
webhooks, and the pull request events that come back. Decisions: [ADR 0057](../../docs/decisions/0057-forge-port.md),
[ADR 0060](../../docs/decisions/0060-factory-spec-forge-port.md) (event names, `hooks`, `unhook`),
[ADR 0062](../../docs/decisions/0062-gatekeeper-ports.md) (`comments`, the author, labels, draft and paths of `pr`),
[ADR 0065](../../docs/decisions/0065-intake-issues-and-alerts.md) (`issue.labeled@v1`).

## The interface

A forge adapter is a program with these commands. Its client (foreman, intake, a script, a test) runs them as any
command line. A repository is `<owner>/<name>`; every command prints JSON lines.

| Port operation | Command |
| --- | --- |
| branch | `<adapter> branch <repo> <branch> [--from <ref>]` prints `{"branch", "sha"}`; the default `--from` is the default branch |
| open a pull request | `<adapter> open-pr <repo> <head> --title <text> [--body <text>] [--base <branch>]` prints `{"number", "url", "head", "base", "sha"}` |
| merge state | `<adapter> pr <repo> <number>` prints `{"number", "url", "title", "state", "mergeable", "head", "base", "sha", "mergeCommit", "author", "labels", "draft", "paths", "checks"}` |
| checks | `<adapter> check <repo> <sha> <name> <pending\|success\|failure\|error> [--description <text>] [--url <url>]` |
| comment | `<adapter> comment <repo> <number> <text>` prints `{"id", "url"}` |
| comments | `<adapter> comments <repo> <number>` prints one `{"id", "url", "author", "time", "text", "mine"}` per comment of the conversation, oldest first |
| merge rules | `<adapter> protect <repo> <branch> [--check <name>]... [--approvals <n>]` |
| merge | `<adapter> merge <repo> <number> [--method merge\|squash\|rebase]` prints `{"sha"}` |
| webhooks | `<adapter> webhook <repo> <url> [--event <name>]...` registers one webhook for the events, by default pull requests and their reviews; prints `{"id", "url", "events", "active"}` |
| list webhooks | `<adapter> hooks <repo>` prints one such line per webhook |
| remove a webhook | `<adapter> unhook <repo> <id>` prints `{"id", "removed"}` |
| pull request and issue events | `<adapter> event <delivery.json>` prints a `pr.opened@v1`, `pr.reviewed@v1`, `pr.closed@v1` or `issue.labeled@v1` CloudEvent |

`state` is `open`, `closed` or `merged`; `mergeable` is true when the pull request has no conflict with its base;
`checks` lists `{"name", "state", "description", "url"}` of the head commit, one per name. `author` is
`<adapter>:<login>`, `labels` lists the label names, and `paths` holds the first 100 changed files. In `comments`,
`time` is ISO 8601 and `mine` is true for the comments of the token's user.

An event name is the port's, `<object>[.<action>]` as in an automation of `factory.yaml`: `pull_request`,
`pull_request.labeled`, `pull_request_review`, `issue`, `issue.labeled`, `issue_comment` or `push`. Each adapter maps
it to its forge's events; an action it does not know maps like its object, and any other object is the forge's own
event name. `webhook` and `hooks` print the forge's own names, sorted.

Every adapter reads three variables:

| Variable | Meaning |
| --- | --- |
| `FORGE_URL` | The forge's base URL. |
| `FORGE_TOKEN` | An API token that may write to the repositories. |
| `FORGE_WEBHOOK_SECRET` | The secret of the webhooks `webhook` registers, and that `event` checks. |

## What every adapter guarantees

- A branch that exists is refused; a token the forge refuses exits 1 with `the forge refused the token`; a repository
  the forge does not have exits 1 with `no repository <repo>`; `pr`, `comments` and `comment` on a pull request the
  repository does not have exit 1 with `no pull request <repo>#<number>`.
- A check is a commit status with the check's name as its context, which is what the merge rules require.
- `merge` exits 1 with an error that names the pull request when the merge rules refuse it or it conflicts with its
  base, and leaves it open. `protect` replaces the branch's rules each time.
- `webhook` keeps one webhook per URL: a second call for the same URL updates it and replaces its events.
- `unhook` of a webhook the repository does not have prints `"removed": false` and exits 0.
- `event` reads a delivery as a JSON file `{"headers": {...}, "body": "<the body as it arrived>"}`. With
  `FORGE_WEBHOOK_SECRET` set, a delivery whose signature does not match exits 1 and prints no event. A delivery about
  an opened, reviewed or closed pull request prints one CloudEvent that the contract accepts: its `id` is the forge's
  delivery ID, its `source` `/osf/forge`, and a person is `<adapter>:<login>`. A delivery about a label added to an
  issue prints one `issue.labeled@v1` with the issue's link, number, title, body, author and every label after the
  change; `label` names the one added when the forge says which (GitHub does, Forgejo does not, and Forgejo also
  sends it when a label is removed). Any other delivery prints nothing and exits 0.

## Conformance

The shared behavior is the `@conformance` scenarios in [`features/`](features/forge.feature) (prefix `SCN-FORGE`).
Every adapter in `adapters/forge/<name>/` has one system test per scenario. The test forge is the testkit's
`fakes.forge`, a real Forgejo, for `forgejo`, and `fakes.github`, the testkit's fake of GitHub's REST API, for
`github` (ADR 0058). The webhook receiver is `fakes.http`. A community
adapter shows conformance with `testkit conformance <its copy of this features folder> --junit report.xml` against a
forge it brings.

## Adapters

| Adapter | Tier | What it calls |
| --- | --- | --- |
| [`forgejo`](../../adapters/forge/forgejo/README.md) | core | Forgejo's REST API v1, for example Codeberg |
| [`github`](../../adapters/forge/github/README.md) | core | GitHub's REST API, on github.com or GitHub Enterprise Server |
