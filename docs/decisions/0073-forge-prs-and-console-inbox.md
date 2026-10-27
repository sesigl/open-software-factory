---
status: accepted
date: 2026-10-27
---

# 0073. The forge port lists pull requests by branch prefix; the console shows observer's proposals as an inbox

## Context

The last slice of TODO item T-18 is the self-improvement inbox. The vision scenario SCN-FACTORY-IMPROVE-004 says:
a factory engineer opens the inbox and sees the open proposals, their age and their state "needs review" or
"approved".

What exists:

- observer opens each proposal as a pull request from the branch `observer/<problem>-<hash>` (ADR 0046). It keeps
  no list of them; the forge is the record.
- The forge port (ADR 0057, ADR 0062) reads one pull request with `pr <repo> <number>`, but it has no operation that
  lists pull requests, and none that reads reviews. A client cannot find observer's pull requests without knowing
  their numbers.
- The console (ADR 0072) is read-only and asks the other systems when a page is opened. gatekeeper and intake
  already run a forge adapter as a program for the forge (ADR 0062, ADR 0065).
- The testkit's fake GitHub (ADR 0058) keeps pull requests and reviews, but answers neither the list of pull
  requests nor the list of reviews.

## Decision

### The port operation `prs`

- **`<adapter> prs <repo> [--head <prefix>] [--state open|closed|all]`** prints one line per pull request, newest
  first (the highest number first): `{"number", "url", "title", "state", "head", "base", "author", "created",
  "draft", "review"}`. `state` is `open`, `closed` or `merged`, `author` is `<adapter>:<login>`, `created` is ISO
  8601.
- **`--head` is a prefix of the branch.** Neither GitHub nor Forgejo filters by a prefix, so the adapter reads every
  page of the list, at most 20 pages (2,000 pull requests on GitHub, 1,000 on Forgejo), and keeps the pull
  requests whose head branch starts with it. Without `--head` it keeps all.
- **`--state` defaults to `open`.** `closed` lists closed and merged pull requests; `all` lists every one.
- **`review` is the review state:** `changes_requested` when the latest review of some reviewer asks for changes,
  else `approved` when the latest review of some reviewer approves, else `none`. Only the latest verdict of each
  reviewer counts; comments and dismissed reviews do not count. Both forges refuse an author's verdict on their own
  pull request. The
  adapter reads the reviews of each listed pull request.
- Its shared behavior is the conformance scenarios `SCN-FORGE-031` to `-033`; both adapters, forgejo and github,
  implement it. The fake GitHub of the testkit answers `GET /repos/<repo>/pulls` and
  `GET /repos/<repo>/pulls/<number>/reviews`.

### The inbox page

- **`/inbox`** lists the open pull requests of `CONSOLE_INBOX_REPOSITORY` whose branch starts with
  `CONSOLE_INBOX_PREFIX` (default `observer/`): title with the link to the pull request, branch, author, age and
  state. The state is "approved", "changes requested" or "needs review", from `review`. The age counts from
  `created` like a run's age.
- **The console runs the forge adapter** in `CONSOLE_FORGE_ADAPTER` (default `npx -y @opensoftware/forge-github`)
  with `FORGE_URL` from `CONSOLE_FORGE_URL` and `FORGE_TOKEN` from `CONSOLE_FORGE_TOKEN`. It runs only `prs`, which
  only reads. A token that may only read pull requests is enough.
- An adapter that fails is named on the page with its error, like a foreman that does not answer. Without
  `CONSOLE_INBOX_REPOSITORY`, `/inbox` answers 404 and names the variable, and the navigation has no inbox link.
- In the layers of ADR 0072, the program call is an `adapters` file, the review states are `domain`, and the page is
  a `pages` component.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A port operation `prs` with a branch prefix and the review state | One call answers the inbox; both forges can do it with their REST APIs; any client, such as a script, can use it | The adapter reads the reviews of each pull request: one call per pull request |
| `prs` without the review state, and a second operation `reviews <repo> <number>` | Smaller operations | The console would run the adapter once per pull request; each run is a process |
| GitHub's GraphQL `reviewDecision` | GitHub computes the state with the branch's rules | GitHub only; Forgejo has no GraphQL; the port's adapters use REST |
| GitHub's search API, `head:observer/` | Filters on the forge | Search matches words, not a prefix; separate rate limits; Forgejo has no such search |
| observer keeps a list of its proposals and serves it | No forge call | A second store of what the forge knows; it goes stale when a person closes or merges a pull request |
| The console calls GitHub's API itself | No process per page | A forge client in the console; the port exists so modules do not talk to a forge directly (ADR 0057) |

## Prior art

- GitHub REST API, "List pull requests" and "List reviews for a pull request" (`2022-11-28`): used by the github
  adapter. The REST API has no review decision; GraphQL's `reviewDecision` is the model for `review`.
- Forgejo REST API v1, `GET /repos/{owner}/{repo}/pulls` and `.../pulls/{index}/reviews` (GPL-3.0 since v9, very
  active): used by the forgejo adapter; its review states are `APPROVED`, `REQUEST_CHANGES` and `COMMENT`.
- GitHub CLI `gh pr list` (MIT, very active) and Gitea's `tea pulls` (MIT, active): checked for the fields of a
  pull request list. `gh` filters by an exact head branch only. Neither is a port; the adapters keep using `fetch`.
- Octokit (MIT, very active): not adopted; the github adapter already calls the REST API with `fetch` (ADR 0058).
- Renovate's dependency dashboard and GitHub's pull request list: checked for the shape of an inbox. They list
  title, age and review state, as the inbox does.

## Consequences

- A factory engineer sees observer's open proposals with their age and review state in the console, and opens each
  pull request from there. With this, T-18 is done.
- Any client of the forge port can list pull requests by branch, for example foreman's or a script's own branches.
- The inbox costs one adapter process and one forge call per page of pull requests plus one per listed pull request
  each time it is opened. Revisit when a repository has hundreds of open proposals.
- Adding an operation to the port is not a breaking change; both adapters raise their minor version.
- Each scenario of forge-forgejo starts a Forgejo container, and each mutant reruns its scenarios in a new process.
  So one CI runner cannot test the mutants of a change of 80 lines. A unit's `package.json` may set
  `osf.mutationLinesPerShard` (default 100), and forge-forgejo sets 25: its changes get four times the runners.
