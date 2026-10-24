---
status: accepted
date: 2026-10-24
---

# 0058. The github forge adapter calls GitHub's REST API; fakes.github is the testkit's GitHub

## Context

TODO item T-15 asks for a `github` forge adapter that passes the same `@conformance` scenarios as `forgejo`
(`ports/forge/features/`, ADR 0057). Those scenarios need a forge that holds state: a branch a test reads back, a
pull request that merges into `main` and changes its files, a conflict, merge rules that refuse a merge, and signed
webhook deliveries. System tests may not reach the real GitHub (NOREAL), and the testkit's scripted `fakes.http`
answers fixed routes only (ADR 0021). So the testkit needs a GitHub that keeps state, like `fakes.forge` for Forgejo
(ADR 0016) and `fakes.slack` for Slack (ADR 0048).

## Decision

- **The adapter is `adapters/forge/github`** (`@opensoftware/forge-github`, core): GitHub's REST API (version
  `2022-11-28`) with `fetch`, no client library, the same commands and output as `forge-forgejo`.
  - `FORGE_URL` is the API's base URL. It defaults to `https://api.github.com`; GitHub Enterprise Server is
    `https://<host>/api/v3`. `FORGE_TOKEN` is a fine-grained or classic token with write access to contents, pull
    requests, commit statuses and administration (for branch protection and webhooks).
  - `branch` creates the ref `refs/heads/<branch>` at the commit of `--from` or of the default branch.
  - Checks are commit statuses (ADR 0057). `pr` reads the combined status of the head commit.
  - GitHub computes whether a pull request can merge in the background and answers `mergeable: null` until it knows;
    `pr` asks again for up to 10 seconds.
  - `protect` replaces the branch protection: the required status checks, the number of required approving
    reviews, and `enforce_admins`, so the rules hold for the factory's token too, even an admin's.
  - `merge` names GitHub's reason when it refuses: a failing required check, a missing approval, or `Pull Request is
    not mergeable` for a conflict.
  - A webhook has the events `pull_request`, `pull_request_review` and `issue_comment`, JSON content and the secret
    `FORGE_WEBHOOK_SECRET`. `issue_comment` makes the comments on a pull request reach the same receiver; `event`
    prints nothing for them (SCN-FORGE-017).
  - `event` checks `X-Hub-Signature-256` (`sha256=` and the HMAC-SHA256 of the body), reads the type from
    `X-GitHub-Event`, and takes `X-GitHub-Delivery` as the CloudEvent's `id`. `pull_request` with `opened` and
    `closed` and `pull_request_review` with `submitted` become `pr.opened@v1`, `pr.closed@v1` and `pr.reviewed@v1`.
    A person is `github:<login>`, as in ledger's import (ADR 0036).
- **`fakes.github()`** is an in-process fake of the part of GitHub's REST API the adapter calls, with the same
  `Forge` interface as `fakes.forge()`: the user `tester` with a token, the person `reviewer`, repositories whose
  commits hold their files, branches, pull requests with three-way merges and conflicts, commit statuses, comments,
  reviews, branch protection with `enforce_admins`, and webhooks that deliver signed `ping`, `pull_request`,
  `pull_request_review` and `issue_comment` events to their URLs. Its IDs, commit SHAs and times come from counters
  and the fixed clock, so a scenario sees the same values each run. A call it does not know answers 404 and fails
  the scenario, like `fakes.slack`.
- **The conformance scenarios stay as they are.** The feature's description names both test forges.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| An in-process `fakes.github` with the `Forge` interface | The adapter's tests read like forgejo's; no container; exact GitHub answers we choose; fast | We keep a GitHub model in the testkit |
| vercel-labs/emulate's GitHub service | Large stateful GitHub, maintained, Apache-2.0 | No commit status API; a merge takes the head's tree, so no conflict; required checks read only check runs |
| `fakes.http` with scripted answers per scenario | No new fake | Exact routes, no state: a merge cannot change `main`, a webhook cannot be delivered |
| The real GitHub in CI with a test organization | The real behavior | A credential in CI, network, rate limits, and NOREAL forbids it |
| Octokit (`@octokit/rest`, `@octokit/webhooks-methods`) in the adapter | Typed calls, paging | Twelve calls that are a few lines each with `fetch`; one HMAC; the forgejo adapter uses `fetch` too |
| GitHub's checks API for checks | Annotations | Needs a GitHub App (ADR 0057) |

## Prior art

- vercel-labs/emulate (Apache-2.0, Vercel Labs, very active, 0.12.3 from October 2026): stateful emulators of
  GitHub, Slack, Linear and more, with real webhook delivery. Checked, not adopted for this slice: it has no
  `POST /repos/{owner}/{repo}/statuses/{sha}` or combined status, its merge copies the head's tree without a merge
  base, so a conflict cannot be shown, and its branch protection checks check runs, which a user token cannot create
  on GitHub. A candidate again for the channel port's Slack and GitHub channels, and upstream if it gains statuses.
- Octokit `@octokit/rest` and `@octokit/webhooks` (MIT, GitHub, very active): GitHub's own client and webhook
  verification. Not adopted, see the table; the adapter verifies the signature with `node:crypto`.
- `@octokit/fixtures` (MIT, GitHub, little activity since 2024): recorded answers of the real API. Not adopted: fixed
  recordings, no state.
- gh's `fake_github_app` (MIT, r-lib, maintained) and ephemerd's `ghfake` (Go): small fakes of the subset their own
  clients use, in R and Go. Their approach, a fake of only the calls the client makes, is the one adopted here.
- WireMock and Prism (Apache-2.0, active): mock servers from recorded or OpenAPI answers. Not adopted: no state.

## Consequences

- foreman and intake can work with GitHub through `forge-github` exactly as with Forgejo.
- A module that calls GitHub can test against `fakes.github()` instead of scripting `fakes.http` routes.
- The fake follows GitHub only as far as its scenarios show; a GitHub behavior a new scenario needs is added to the
  fake with a testkit scenario first.
- Revisit when emulate gains commit statuses and merge bases, or when a scenario needs GitHub Apps or check runs.
