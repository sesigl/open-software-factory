---
covers: [ports/forge/**]
---

# forge port

How the factory works with the company's code forge: branches, pull requests, checks, comments, merge rules,
webhooks, and the pull request events that come back. Decision: [ADR 0057](../../docs/decisions/0057-forge-port.md).

## The interface

A forge adapter is a program with these commands. Its client (foreman, intake, a script, a test) runs them as any
command line. A repository is `<owner>/<name>`; every command prints JSON lines.

| Port operation | Command |
| --- | --- |
| branch | `<adapter> branch <repo> <branch> [--from <ref>]` prints `{"branch", "sha"}`; the default `--from` is the default branch |
| open a pull request | `<adapter> open-pr <repo> <head> --title <text> [--body <text>] [--base <branch>]` prints `{"number", "url", "head", "base", "sha"}` |
| merge state | `<adapter> pr <repo> <number>` prints `{"number", "url", "title", "state", "mergeable", "head", "base", "sha", "mergeCommit", "checks"}` |
| checks | `<adapter> check <repo> <sha> <name> <pending\|success\|failure\|error> [--description <text>] [--url <url>]` |
| comments | `<adapter> comment <repo> <number> <text>` prints `{"id", "url"}` |
| merge rules | `<adapter> protect <repo> <branch> [--check <name>]... [--approvals <n>]` |
| merge | `<adapter> merge <repo> <number> [--method merge\|squash\|rebase]` prints `{"sha"}` |
| webhooks | `<adapter> webhook <repo> <url>` registers one webhook for pull request events |
| pull request events | `<adapter> event <delivery.json>` prints a `pr.opened@v1`, `pr.reviewed@v1` or `pr.closed@v1` CloudEvent |

`state` is `open`, `closed` or `merged`; `mergeable` is true when the pull request has no conflict with its base;
`checks` lists `{"name", "state", "description", "url"}` of the head commit, one per name.

Every adapter reads three variables:

| Variable | Meaning |
| --- | --- |
| `FORGE_URL` | The forge's base URL. |
| `FORGE_TOKEN` | An API token that may write to the repositories. |
| `FORGE_WEBHOOK_SECRET` | The secret of the webhooks `webhook` registers, and that `event` checks. |

## What every adapter guarantees

- A branch that exists is refused; a token the forge refuses exits 1 with `the forge refused the token`; a repository
  the forge does not have exits 1 with `no repository <repo>`.
- A check is a commit status with the check's name as its context, which is what the merge rules require.
- `merge` exits 1 with an error that names the pull request when the merge rules refuse it or it conflicts with its
  base, and leaves it open. `protect` replaces the branch's rules each time.
- `webhook` keeps one webhook per URL: a second call for the same URL updates it.
- `event` reads a delivery as a JSON file `{"headers": {...}, "body": "<the body as it arrived>"}`. With
  `FORGE_WEBHOOK_SECRET` set, a delivery whose signature does not match exits 1 and prints no event. A delivery about
  an opened, reviewed or closed pull request prints one CloudEvent that the contract accepts: its `id` is the forge's
  delivery ID, its `source` `/osf/forge`, and a person is `<adapter>:<login>`. Any other delivery prints nothing and
  exits 0.

## Conformance

The shared behavior is the `@conformance` scenarios in [`features/`](features/forge.feature) (prefix `SCN-FORGE`).
Every adapter in `adapters/forge/<name>/` has one system test per scenario. The test forge is the testkit's
`fakes.forge`, a real Forgejo, and the webhook receiver is `fakes.http(routes, { containers: true })`. A community
adapter shows conformance with `testkit conformance <its copy of this features folder> --junit report.xml` against a
forge it brings.

## Adapters

| Adapter | Tier | What it calls |
| --- | --- | --- |
| [`forgejo`](../../adapters/forge/forgejo/README.md) | core | Forgejo's REST API v1, for example Codeberg |
