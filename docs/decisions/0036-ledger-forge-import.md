---
status: accepted
date: 2026-10-21
---

# 0036. ledger imports a forge's pull requests and reviews as pr.* events

## Context

ledger reads the pull request events `pr.opened@v1`, `pr.reviewed@v1` and `pr.closed@v1` (ADR 0034). In the factory,
the forge adapters of T-15 publish them. A team that uses ledger alone has no forge adapter, so it has no events and
no throughput, cycle time, human interactions or revert rate. TODO item T-08 lists "an import of a forge's pull
requests and reviews as `pr.*` events, for teams without forge adapters" as its third slice.

GitHub's REST API and Forgejo's API v1 (also Gitea's) have the same shape for the three lists ledger needs: the pull
requests of a repository, the reviews of a pull request, and the comments of its issue. proof already talks to both
through one small `fetch` client (ADR 0028).

## Decision

- **Command.** `ledger import [--forge github|forgejo] [--since <date>] [--out <file>] <repository URL>` reads one
  repository and writes its events as JSON Lines to `--out` (default `$OUTPUT/pr-events.jsonl`). It prints
  `wrote 5 events of 2 pull requests to <file>`. The file is input for `ledger ingest` and `ledger report`, so a team
  can keep it, read it, and ingest it into DuckDB or PostgreSQL as before.
- **Forge.** The host `github.com` is GitHub, any other host is Forgejo; `--forge` overrides it, for example for
  GitHub Enterprise. The API is `https://api.github.com` for github.com, `<origin>/api/v3` for another GitHub host
  and `<origin>/api/v1` for Forgejo. `LEDGER_FORGE_URL` replaces it. `LEDGER_FORGE_TOKEN` is sent as
  `Authorization: token <token>`, which both forges accept; without it, ledger reads a public repository. ledger
  never prints the token.
- **Mapping.**
  - Each pull request gives `pr.opened@v1` at its creation time, with its URL, repository, number, title, branches,
    head commit and author.
  - Each submitted review gives `pr.reviewed@v1` at its submit time: approved, changes requested, or commented
    (also for a dismissed review). A pending review is left out.
  - Each comment on the pull request's conversation gives `pr.reviewed@v1` with the state `commented`. Line comments
    belong to a review and are not read again.
  - A closed pull request gives `pr.closed@v1` at its merge or close time, with `merged` and the merge commit.
  - A review or comment by the author of the pull request is left out: it is no review, and it would move the first
    human review earlier.
  - A user of type `Bot` or with a login that ends in `[bot]` is a trigger, and its reviews are `automated`. IDs are
    `github:<login>` or `forgejo:<login>`.
  - The event source is the repository URL; the event ID names the pull request and the review or comment, like
    `pr-7-review-80`. An import of the same repository again gives the same IDs, so ingesting it twice counts each
    record once.
- **Paging and period.** ledger pages through each list (100 per page on GitHub, 50 on Forgejo, their maximum)
  until a page is short. `--since <date>` asks for the pull requests by their last update, newest first, and stops at
  the first one updated before the day, so a daily import of a large repository makes few requests.
- **Errors.** A forge that answers with an error exits 1 with the method, the path and the status, and writes no
  file. A URL without an owner and a repository exits 2.
- **Tests.** The GitHub scenarios run against `fakes.http` with the answers of GitHub's REST API (ADR 0021). One
  scenario runs against the real Forgejo of `fakes.forge` (ADR 0016), which proves the shape of Forgejo's answers.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| `ledger import` writes a JSON Lines file of events | The file is the contract (`contracts/`); ingest stays the one way in; a team can inspect and keep it | One more step before `report` |
| `ledger import` writes into the database directly | One step | A second way into the tables; the events are not visible |
| `fetch` with the shared shape of GitHub and Forgejo | No dependency; one client for two forges; proof does the same | ledger pages by hand |
| Octokit (`@octokit/rest`) | Typed GitHub API, paging and rate limits | GitHub only; Forgejo needs a second client |
| GitHub's GraphQL API | Pull requests with reviews and comments in few requests | GitHub only; a second query language |
| A review or comment by the author counts | Every comment is attention | The author's "ready for review" becomes the first human review |

## Prior art

- Octokit `@octokit/rest` (MIT, GitHub, active): not adopted, see the table.
- Apache DevLake (Apache-2.0, active) collects GitHub, GitLab and Gitea pull requests and reviews into its own tables.
  It is a server with its own database and scheduler; ledger needs only three lists. Its mapping of review states and
  bot accounts shaped this one.
- Google's Four Keys (Apache-2.0, archived in 2024) read forge webhooks into BigQuery for DORA metrics: not adopted,
  archived and webhook-only.
- The GitHub CLI `gh pr list --json` (MIT, active) lists pull requests but not their reviews and comments in one
  call, and only for GitHub.

## Consequences

- A team without forge adapters gets throughput, cycle time, human interactions and the revert rate from one command
  per repository, for example in a nightly CI job before `ledger ingest`.
- An import makes one request per page of pull requests and two per pull request. A first import of a large
  repository is slow and counts against the forge's rate limit; `--since` keeps later imports small.
- A pull request opened by the factory and imported later has no `runId` or `workItemId`. Its runs still link to it
  through `osf.pull_request.urls` (ADR 0034).
- GitLab is not covered: its merge request API has another shape. Revisit when a team asks, or with the forge port
  of T-15.
