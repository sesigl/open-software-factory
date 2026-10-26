---
status: accepted
date: 2026-10-26
---

# 0064. fakes.forge starts one Forgejo per test process

## Context

`fakes.forge()` started a Forgejo container for each scenario and stopped it at the scenario's end (ADR 0016). A
Forgejo needs about 6 seconds to start and to create its users, and more when several start at once on a 4-core
runner. The forge adapter's 29 scenarios each start one, and so do 9 scenarios of factory-spec, 7 of the testkit and
1 of taskcapture.

On pull request #117 the forge adapter's suite took 302 seconds, summed over its scenarios, against its budget of
300 seconds, with no change to the adapter. On `main` it took between 190 and 220 seconds. Most of the time is
startup. Since ADR 0051, a Vitest worker runs many scenario files one after the other in one process, so a worker
can keep a forge for its next scenario.

## Decision

- The first scenario of a test process that calls `fakes.forge()` starts the Forgejo. Later scenarios in that process
  get the same container, URL, user `tester` and token. testcontainers' Ryuk stops the container when the process
  ends.
- Before it returns the forge, `fakes.forge()` deletes every repository of `tester`. With a repository go its
  branches, pull requests, comments, statuses, reviews, webhooks, branch rules and collaborators. A scenario sees only
  what it creates, as before.
- The user `reviewer` is created by the first review or comment of the process. Each scenario's first review adds it
  to that scenario's repository again.
- Scenarios in one process run one after the other (ADR 0051). Workers run side by side, and each has its own
  Forgejo, so two scenarios never share a forge at the same time.
- If the Forgejo fails to start, the next scenario tries again.
- Scenario SCN-TK-101 checks the behavior: two scenarios in one test file both create the repository `demo`, both
  see one pull request, and the second gets the forge URL of the first.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| One Forgejo per scenario (before) | Nothing carries over between scenarios | About 6 s of startup per scenario; the forge suite is at its budget |
| One Forgejo per test process, repositories deleted per scenario | Startup once per worker; no change to any test | State outside repositories, such as users and tokens, carries over |
| One Forgejo for the whole run (Vitest `globalSetup`) | Startup once | Workers run side by side and share `tester/web`; each scenario would need its own owner, and the port scenarios name `tester/web` |
| testcontainers `withReuse()` | Keeps a container across runs | Needs a setting on each machine, and the state of the last run carries over |
| A snapshot of a started Forgejo as an image | Faster start | One more image to build and pin, and still one container per scenario |

## Prior art

- Testcontainers for Node (`testcontainers` 12.2.0, MIT, very active) documents both patterns: a container per test,
  and a container shared by a test file or suite and cleaned between tests. Its `withReuse()` keeps containers across
  runs. We use the shared pattern with Ryuk for the cleanup, and no new dependency.
- Vitest (`globalSetup`, `provide`/`inject`, MIT, very active) can start a service once for a run. Checked, not
  adopted: its workers run side by side, so they would need separate owners.

## Consequences

- Measured locally on 4 cores, one run each: the forge adapter's suite took 232.8 seconds summed and 81 seconds
  wall-clock before, 106.7 seconds and 37 seconds after. Its 29 scenarios and the 17 other scenarios that use
  `fakes.forge()` pass unchanged.
- A scenario that changes something outside a repository, such as a user's settings or a new token, would leak into
  the next scenario of its worker. No scenario does that today. If one needs it, it deletes what it created, or the
  fake also resets that state.
- The other container fakes (`nats`, `temporal`, `s3`) still start per scenario. They start in 1 to 2 seconds; move
  them to this pattern when a suite's budget needs it.
