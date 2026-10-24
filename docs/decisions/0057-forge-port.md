---
status: accepted
date: 2026-10-24
---

# 0057. The forge port is a command line; the forgejo adapter calls Forgejo's API v1

## Context

TODO item T-15 asks for a forge port: branch, pull request, checks, comments, merge rules and webhooks, with GitHub
and Forgejo adapters, and the pull request events `pr.opened`, `pr.reviewed` and `pr.closed` that ledger already
reads (ADR 0034). The vision asks that the factory works with the company's own forge (SCN-FACTORY-OPEN-005) and that
a reviewed and verified change merges into the company's pipeline (LOOP-009).

Today four modules talk to a forge on their own: factory-spec registers Forgejo webhooks (ADR 0022), taskcapture and
observer read and open pull requests (ADR 0043, ADR 0046), and gatekeeper posts comments and commit statuses (ADR
0047). Modules may not import adapters (ISOLATION), so foreman needs a way to open and merge a pull request without a
library call, as for the sandbox and inference ports (ADR 0054, ADR 0056). The testkit's test forge is a real Forgejo
(`fakes.forge`, ADR 0016), so Forgejo is also the forge every conformance scenario can run against.

## Decision

- **The port is a command line.** A forge adapter is a program with these commands. Their shared behavior is the
  `@conformance` scenarios in `ports/forge/features/` (prefix `SCN-FORGE`). A repository is `<owner>/<name>`, and
  every command prints JSON lines:
  - `branch <repo> <branch> [--from <ref>]` creates a branch from the default branch or a ref, prints `{"branch",
    "sha"}`, and refuses a branch that exists.
  - `open-pr <repo> <head> --title <text> [--body <text>] [--base <branch>]` opens a pull request and prints
    `{"number", "url", "head", "base", "sha"}`.
  - `pr <repo> <number>` prints its merge state: `state` (`open`, `closed` or `merged`), `mergeable` (no conflict),
    the head commit, the merge commit once merged, and its checks.
  - `check <repo> <sha> <name> <pending|success|failure|error> [--description <text>] [--url <url>]` posts a check
    on a commit.
  - `comment <repo> <number> <text>` posts a comment on a pull request and prints `{"id", "url"}`.
  - `protect <repo> <branch> [--check <name>]... [--approvals <n>]` sets the merge rules of a branch: the checks that
    must pass and the number of approvals.
  - `merge <repo> <number> [--method merge|squash|rebase]` merges, prints `{"sha"}` of the merge commit, and exits 1
    with the forge's reason when the merge rules refuse it.
  - `webhook <repo> <url>` registers one webhook for pull request events at the URL; a second call for the same URL
    keeps one webhook.
  - `event <delivery.json>` turns one webhook delivery into a CloudEvent `pr.opened@v1`, `pr.reviewed@v1` or
    `pr.closed@v1` from `contracts/`, or prints nothing for any other delivery.
- **Every adapter reads three variables:** `FORGE_URL` (the forge's base URL), `FORGE_TOKEN` (an API token) and
  `FORGE_WEBHOOK_SECRET` (the secret of the webhooks it registers and checks). A token the forge refuses exits 1 with
  `the forge refused the token`; a repository it does not have exits 1 with `no repository <repo>`.
- **A delivery is a JSON file** `{"headers": {...}, "body": "<the body as it arrived>"}`, so the adapter checks the
  signature against the body's bytes. The receiver (intake) writes it from the HTTP request it got. With a secret, a
  delivery whose signature does not match exits 1 and prints no event. The CloudEvent's `id` is the forge's delivery
  ID, its `source` is `/osf/forge`, and people are `<adapter>:<login>`, for example `forgejo:tester`.
- **Checks are commit statuses.** GitHub's checks API needs a GitHub App, and Forgejo has only statuses. A status
  with a context name works on both and is what branch protection checks.
- **The first adapter is `adapters/forge/forgejo`** (`@opensoftware/forge-forgejo`, core): Forgejo's REST API v1
  with `fetch`, no client library. Forgejo checks whether a new pull request can merge in the background and answers
  405 until it knows; `pr` and `merge` wait for that, up to 10 seconds. A pull request that conflicts with its base
  gets the same answer, so it takes 10 seconds to report. A webhook is a
  Forgejo webhook of type `forgejo` with JSON content, the events `pull_request` and the three review events, and the
  secret. Its signature is the header `X-Forgejo-Signature`, an HMAC-SHA256 of the body.
- **The testkit's test forge** reaches a fake for containers at `host.docker.internal`, so a scenario registers a
  webhook and receives a real delivery. `fakes.forge` also creates branches, lists branches and webhooks, and reviews
  a pull request as a second person, `reviewer`. `fakes.http` gives the text of each body as it arrived.
- **Later slices of T-15:** the `github` forge adapter, the channel port with Vercel Chat SDK and its `slack` and
  `github` channels, factory-spec's webhooks of `github.*` automations through this port, and gatekeeper's calls
  through both ports.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A command line per adapter, statuses as checks | Same shape as the sandbox and inference ports; ISOLATION holds; one check API on every forge | GitHub's richer check runs (annotations) are not used |
| A library `packages/forge` that modules import | One call per operation, typed | A module would depend on every forge's code; adapters could not be community programs in any language |
| GitHub's checks API for the github adapter | Annotations, re-run buttons | Needs a GitHub App; branch protection on statuses works the same; Forgejo has no checks API |
| A delivery as raw body on stdin with headers as flags | No file | Each forge has other header names; a file holds headers and body for any forge |

## Prior art

- Forgejo (GPL-3.0-or-later since v9, Codeberg e.V., very active, v11 used here): its REST API v1 is what the adapter
  calls over HTTP; nothing of Forgejo is linked into the adapter. Adopted as the forge the port is tested against.
- go-scm (BSD-3-Clause, Drone and Jenkins X, maintained): one Go API over GitHub, GitLab, Gitea, Bitbucket and more,
  with webhook parsing. Checked, not adopted: Go only, and the factory is TypeScript (ADR 0009). Its split of
  operations and webhook parsing per driver is the model for this port.
- gitea-js (MIT, maintained): a TypeScript client generated from Gitea's Swagger file. Checked, not adopted: the
  adapter needs eleven calls, which are a few lines each with `fetch`, and the generated client follows Gitea, not
  Forgejo.
- Octokit (`@octokit/rest`, `@octokit/webhooks`, MIT, GitHub, very active): GitHub's own client and webhook
  verification. A candidate for the `github` adapter in the next slice; it does not speak Forgejo.
- Backstage SCM integrations and Renovate's platform layer (Apache-2.0 and AGPL-3.0): multi-forge layers inside larger
  products, not usable on their own. Checked, not adopted.
- Vercel Chat SDK (MIT, very active): one bot API for chat surfaces and GitHub comments. It covers the channel port,
  not branches, statuses, merge rules or webhooks of a forge.

## Consequences

- foreman opens, checks and merges pull requests through any forge adapter; intake turns webhook deliveries into
  `pr.*` events for ledger with `event`, whatever the forge.
- factory-spec, taskcapture, observer and gatekeeper keep their own forge calls until they move to this port; that
  is listed in T-15 and in their items.
- `pr` and `merge` may wait up to 10 seconds on a new pull request while Forgejo checks it, and always on one with a
  conflict.
- A community adapter (GitLab, Bitbucket) is any program that passes `ports/forge/features/` with `testkit
  conformance` against a forge it brings.
- Revisit when a forge needs a check API that statuses cannot express, or when GitHub's adapter needs a GitHub App.
