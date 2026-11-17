---
status: accepted
topic: design-note
date: 2026-11-17
---

# 0163. Small suites share a runner, and kind starts in the background from cached images

## Context

`verify.yml` starts one runner per test suite of `.github/test-suites.yml` (ADR 0094). Each runner checks out, sets up
Node and pnpm, restores the turbo cache and the pinned tools and runs `make install` before its tests. Measured on three
successful runs of `main` (43987462100, 43990293428, 43993575818; medians of the steps' times):

| Suite | Setup s | Test step s | Wall time of the tests s | Job s |
| --- | --- | --- | --- | --- |
| ui | 92 | 8 | 2 | 107 |
| runlog | 48 | 21 | 13 | 87 |
| tools | 42 | 24 | 17 | 70 |
| ledger | 75 | 25 | 16 | 111 |
| observer | 63 | 25 | 17 | 102 |
| sandbox-docker | 46 | 30 | 22 | 81 |
| factory-spec | 70 | 31 | 21 | 110 |
| proof | 69 | 32 | 23 | 103 |
| gatekeeper | 50 | 44 | 32 | 99 |
| forge-forgejo | 81 | 54 | 46 | 141 |
| sandbox-kubernetes | 90 | 72 | 63 | 170 |
| intake | 46 | 72 | 55 | 124 |
| console | 74 | 114 | 92 | 183 |
| testkit | 116 | 117 | 114 | 233 |
| inference-litellm | 52 | 135 | 130 | 191 |
| e2e | 75 | 194 | 109 | 272 |
| rest | 60 | 216 | 173 | 271 |
| foreman | 41 | 230 | 212 | 278 |
| deploy | 112 | 477 | 267 | 600 |

Setup is everything before `make verify-tests`; the test step includes turbo and the builds, which `main` runs again
with `--force`; the wall time of the tests is what `testkit timed` wrote and BUDGET reads (ADR 0155). The first nine
suites, each with under 40 s of tests, used 870 s of runner time, 555 s of it setup. The 19 test jobs and `static`, `plan`,
`cache` and `verify` meet GitHub's limit of 20 jobs at a time for the repository: some test jobs waited up to 65 s for
a runner.

The deploy job's setup took 112 s, 70 s of it the step that starts kind with agent-sandbox: 18 s to pull the node
image, 15 s to start the control plane and 19 s until it is ready. It ran after Node and the install, not beside them.

## Decision

- `osf suite-plan --all | <suite>...` prints the jobs of the tests matrix from `.github/test-suites.yml`. A suite
  shares a job when the budgets of its units add up to at most 80 s (twice under 40 s of tests, ADR 0155), its filter
  names its packages (no `!`), and it sets no `kind`, `cluster` or `timeout`. The shared suites go into at most two jobs,
  longest first into the job with the smaller sum. A shared job is named `a+b+...`, joins the filters, `images` and
  `pull` of its suites, and takes `browser` from them; every other suite is its own entry, unchanged. The job `plan`
  calls it with the suites that have work (on a pull request) or with `--all`.
- A shared job runs its filters in one `make verify-tests`, which runs one test task at a time
  (`--concurrency=1`): BUDGET reads each unit's own wall time, as it does for the suite `rest`. Its reports, its turbo
  entries and its job name carry all its suites; turbo names the package of a failed task, and PASS fails every
  scenario whose result is missing. A result over its budget keeps the new cache entries of the whole shared job out
  of the cache, so its other suites run again on the next push: more work, never a wrong replay.
- A job with kind (`kind` or `cluster: kind`) starts the cluster in the background right after it restores the pinned
  tools, and waits for it in the actions `kind` and `kind-agent-sandbox` (`.github/scripts/kind-images.sh`). With
  agent-sandbox, the background start also applies its manifest. Without a background start (the mutation shards, or
  no cached kind binary) the actions start the cluster themselves, as before.
- The kind node image (the one the pinned kind names, with its digest) and the suite's `pull` images come from
  `actions/cache` entries `kind-node-<digest>` and `kind-pull-<hash of the image names>`, loaded with `docker load` in
  the background. On a miss the job pulls from the registries, as before. Only a push to `main` saves them, after the
  tests, from images the job pulled or the runner already had; an image that deploy's `test:system` baked because its
  pull failed keeps the list out of the cache. The module images that deploy builds from the commit (ADR 0156) are not
  in the `pull` list and never cached. Writing the archives may fail without failing the suite.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Group by budget in `osf suite-plan` (chosen) | No list to keep; a new suite or a changed budget moves by itself; BUDGET already demands a budget line | One more command of `osf` |
| A field `shared: true` in test-suites.yml | Visible in one file | A list to keep in step with the budgets by hand, and a check for it |
| One job for all small suites | One setup instead of two | About 240 s of tests on one runner; the item asks for two |
| Group by the measured times of the last run | Exact | The plan would need the reports of an earlier run; budgets are stable and twice the time |
| Pull the third-party images into the kind node with crictl | No cache | Two pulls of each image, docker's and the node's; the registries stay on the path |
| Save the node and chart images on pull requests too | A miss fills the cache sooner | One copy per pull request in its own scope, against GitHub's 10 GB per repository |

## Prior art

No new dependency. `actions/cache/restore` and `actions/cache/save` (MIT) are used as for the turbo cache; kind 0.30.0's
`kind create cluster --image` and `docker save`/`docker load` are the documented ways to preload an image. Grouping
small jobs into shards by a size is the way of Bazel's test sharding and of `osf mutation-plan` (ADR 0084).

## Consequences

- A run of every suite starts 12 test jobs instead of 19. The nine small suites take two jobs of about 200 and 220 s
  instead of 870 s of runner time: about 7 runner-minutes less per run of `main`, and fewer jobs wait for one of the
  20 runners. The run's wall time stays the deploy job's.
- Expected for the deploy job: the cluster starts beside Node and the install, so its setup falls from 112 s to about
  65 to 70 s; kind's own start and readiness, about 35 s, remain and no cache removes them. The node image from the
  cache saves at most the pull's 18 s, minus the time to restore and load it. The first run on `main` after this change
  and after each new pin saves the entries (about 0.45 GB for the node image and 1.2 GB for deploy's images, compressed),
  which adds the time of `docker save` to that run only.
- Revisit when a shared job comes near the timeout of 20 minutes, when the cache of the repository nears its limit, or
  when the measured deploy setup stays over a minute.
