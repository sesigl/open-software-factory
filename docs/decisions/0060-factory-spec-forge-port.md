---
status: accepted
date: 2026-10-24
---

# 0060. factory-spec manages webhooks through the forge port, for forgejo and github automations

## Context

TODO item T-15 ends with one slice: factory-spec registers the webhooks of `github.*` automations through the forge
port, as it does for Forgejo today (ADR 0022), and gatekeeper asks for approvals and posts its records through the
channel and forge ports. This decision covers factory-spec. Gatekeeper follows in its own change.

factory-spec calls Forgejo's hooks API itself (ADR 0022). It records each webhook's ID in its state, updates it,
recreates it when a person deleted it, removes it when the factory drops the automation, and reports a changed URL,
event list or active flag as drift. The forge port (ADR 0057) has only `webhook <repo> <url>`: one webhook for pull
request events, kept once per URL. It cannot name other events, list webhooks or remove one.

No module runs an adapter yet. ISOLATION forbids a module to depend on an adapter's package, so a module cannot
import one or install its `bin` as a dependency. A system test may not compute paths or import `node:` modules
(BOUNDARY-STATIC), so it cannot find an adapter's built program on its own.

## Decision

- **The forge port grows three things.** They are `@conformance` scenarios in `ports/forge/features/`, and both
  adapters pass them.
  - `webhook <repo> <url> [--event <name>]...` registers the webhook for the named events. A name is the port's,
    `<object>[.<action>]` as in an automation: `pull_request`, `pull_request.labeled`, `pull_request_review`,
    `issue`, `issue.labeled`, `issue_comment` and `push`. Each adapter maps it to its forge's events; an action it
    does not know maps like its object, and an object it does not know is the forge's own event name. Without
    `--event`, the events are `pull_request` and `pull_request_review`, as before. A second call for the same URL
    replaces the events. It prints `{"id", "url", "events", "active"}` with the forge's own event names, sorted.
  - `hooks <repo>` prints one such line per webhook of the repository.
  - `unhook <repo> <id>` removes the webhook and prints `{"id", "removed"}`; `removed` is false when the repository
    has no such webhook, so removing twice is not an error.
- **factory-spec runs the adapter as a program.** A module names each adapter in a variable that holds a command
  line, like taskcapture's `TASKCAPTURE_HARBOR` (ADR 0045). factory-spec reads `FACTORY_FORGEJO_ADAPTER` (default
  `npx -y @opensoftware/forge-forgejo`) and `FACTORY_GITHUB_ADAPTER` (default `npx -y @opensoftware/forge-github`),
  starts it with the port's variables `FORGE_URL`, `FORGE_TOKEN` and `FORGE_WEBHOOK_SECRET`, and reads its JSON
  lines. When the adapter exits 1, factory-spec exits 1 with the adapter's message.
- **Apply and plan work on any forge.** For every `forgejo.*` automation, the agents' repositories get one webhook on
  the Forgejo at `FACTORY_FORGE_URL` with `FACTORY_FORGE_TOKEN`, as before. For every `github.*` automation, they get
  one on GitHub at `FACTORY_GITHUB_URL` (default `https://api.github.com`) with `FACTORY_GITHUB_TOKEN`, unless apply
  renders gh-aw workflows (`--gh-aw`): then GitHub starts the automation itself. Both forges sign their deliveries
  with `FACTORY_WEBHOOK_SECRET`, which intake checks with the port's `event`.
  - The state keeps the webhook by repository, `<owner>/<name>` on Forgejo as before and `github:<owner>/<name>` on
    GitHub, so a state written by an older version still holds. Plan names the same key in its drift lines.
  - Apply lists the repository's webhooks with `hooks`. It removes the recorded webhook when a person changed its
    URL, then registers the intake URL with `webhook`, which updates a webhook with that URL or creates one. It
    removes the webhook of a repository the factory no longer needs with `unhook`.
  - Plan lists the webhooks with `hooks` and compares the recorded one by its ID, as before.
  - The event names move from factory-spec into the adapters: factory-spec passes the automation's
    `<object>[.<action>]`.
- **The testkit gives a module's test the adapter's command.** `sut.adapter("<port>/<name>")` returns the command
  line of the built program of `adapters/<port>/<name>/` in this repository, found above the module. The test passes
  it in the module's documented variable. The adapter runs as a child of the module, so it gets the module's network
  guard (NOREAL). A module whose tests run an adapter declares that adapter's build in its `turbo.json`, so Turborepo
  builds it first.
- **`fakes.github` removes a webhook** on `DELETE /repos/{owner}/{repo}/hooks/{id}`, as GitHub does.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| The adapter as a program named in a variable | ISOLATION holds; any adapter, also a community one, fits; same shape as taskcapture's harbor | A process per call; `npx` needs the network on the first run |
| factory-spec keeps its own Forgejo client and adds a GitHub client | No new commands in the port | Two forge clients in a module beside two adapters that do the same; the TODO item asks for the port |
| A library in `packages/` that runs adapters | One place for spawning and parsing | Only one module needs it now; a library with one user is premature (ADR 0039) |
| Find webhooks by URL only, with no IDs in the state | No state | A URL a person changed looks like a missing webhook, so drift of the URL cannot be shown (ADR 0022) |
| The forge's own event names on the command line | No mapping in the adapters | The client must know each forge; the port exists so it does not |
| The testkit depends on the adapters' packages | Real package resolution | A cycle: every adapter's tests depend on the testkit |

## Prior art

- The forge port and its adapters (ADR 0057, ADR 0058) and taskcapture's harbor command (ADR 0045) are this
  repository's own; this decision extends them.
- Terraform's `github_repository_webhook` and Gitea providers (MPL-2.0 and MIT, maintained): webhooks with drift, per
  forge. Checked again, not adopted: a second tool and state beside `factory apply` (ADR 0022).
- go-scm (BSD-3-Clause, maintained): one webhook API over many forges with per-driver event names. Its mapping of
  neutral names to each forge's events is the model for `--event`. Go only, not adopted (ADR 0009).
- Probot and Octokit (`@octokit/webhooks`, MIT, GitHub, very active): GitHub only. Not adopted, as in ADR 0058.
- No new dependency: factory-spec starts the adapter with `node:child_process`.

## Consequences

- factory-spec has no forge client of its own. A forge with an adapter that passes the port's scenarios works for
  its automations once factory-spec knows its automation prefix.
- `factory apply` and `factory plan` need the adapters: through `npx` by default, or installed and named in the
  variables. Each call starts a process.
- Apply now needs `FACTORY_WEBHOOK_SECRET`, because the port signs every webhook.
- A forgejo error reads as the adapter's message, such as `the forge refused the token`. SCN-FSPEC-047 named
  Forgejo's own answer; SCN-FSPEC-049 replaces it.
- Revisit when a second module runs adapters: then the spawning and parsing may move into a library.
