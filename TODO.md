# TODO

The work plan toward the factory described in [`docs/vision/`](docs/vision/). Each item holds what an agent needs to
start: the problem, what to build and when it is done. Work an item with `AGENTS.md` and the skills in `skills/`.
The finished items of phase 0, waves 1 to 6 and the paid runs are in
[`docs/history/todo-waves-0-6.md`](docs/history/todo-waves-0-6.md).

How to use an item:
1. Read the item, the linked docs and the vision scenarios it lists.
2. `skills/new-module` (or extend the existing package), then write the listed scenarios with
   `skills/write-scenario`, each with `@realizes=` for the vision scenarios it covers.
3. Implement them one by one: `skills/write-system-test`, then `skills/implement-scenario`.
4. The item is done when its "Done when" list is true and `make verify` passes. Tick it here in the same PR.

Shared context for every item: [principles](docs/principles.md) ·
[components](docs/architecture/components.md) · [internals](docs/architecture/internals.md) ·
[stack](docs/architecture/stack.md) · [testing strategy](docs/quality/testing-strategy.md) ·
[checks](docs/quality/checks.md) · [glossary](docs/reference/glossary.md) ·
[scenario prefixes](docs/reference/scenario-prefixes.md).

---

## Wave 7 · a sound foundation before phase 3

From the audit of 16 November 2026. The first version works, but the human gate, the sandbox, the foreman's failure
handling and the release path have defects, the pipeline reports things that are not true, and the repository carries
more text and packages than it needs. Each item is one pull request unless it lists slices. Order: A, then CI, then
TR, D and E; items of one stage can run in parallel when they touch different units.

### Decided by the owner (November 2026)

- **The testing rule stays "one scenario, one test, from outside"**, with a shared start for scenarios that only read
  an expensive stack, Scenario Outlines for families of "one input, one message", and wording that may change in
  place while the behavior stays (T-81).
- **The Helm and Kubernetes suites run only when needed**, side by side with the others (T-75, T-79).
- **Small packages merge**, and a rule keeps a new package from being created for a small thing (T-88 to T-90).
- **Nobody adds a file to `runs/` by hand** (T-80).
- **Open:** the identity the factory's agents act with on GitHub (T-99).

### Stage A · gates, sandbox and foreman hold

### [x] T-63 · gatekeeper asks only on its configured forge (P0)

- **Problem:** `gatekeeper serve` takes the forge's address from the pull-request link of a gate request
  (`modules/gatekeeper/src/commands/load.ts`, `forgeFor`). The forge is configuration, not request data.
- **Build:** a link counts as the gate's pull request only on the origin of the configured forge; any other link is
  no pull request for the gate (Slack, or 400 without a channel). The foreman passes on only a pull request of the
  run's forge. The profile and the chart set the forge's address.
- **Done when:** scenarios prove that a link to another host is never called and never decides a gate.

### [x] T-64 · a gate on a pull request counts only what came after its request (P0)

- **Problem:** when the request's comment is not in the list (deleted, or past the first page), every comment of
  the pull request counts (`modules/gatekeeper/src/adapters/forge.ts`, `thread`), and decisions past the first
  page of comments are never seen.
- **Build:** no request found means an empty thread; messages older than the request never count; the forge
  adapters page a pull request's comments.
- **Done when:** scenarios prove an older "/approve" does not approve, and a decision after 100 comments does.

### [x] T-65 · a Docker sandbox does not reach the Docker host (P0)

- **Problem:** the sandbox's internal network still has the bridge gateway, so a service that listens on the host
  answers a sandbox without the egress proxy. SCN-SANDBOX-006 passes only because a host name does not resolve.
- **Build:** create the network without a gateway address (`com.docker.network.bridge.gateway_mode_ipv4=isolated`);
  a conformance scenario reaches for the host by address and is refused.
- **Done when:** the new scenario passes for the docker adapter, and the kubernetes adapter passes it too.

### [x] T-66 · a stage survives slow setup and hears a cancel from its start (P0)

- **Problem:** a stage heartbeats only while its turn runs (`modules/foreman/src/workflows/activities.ts`), with a
  heartbeat timeout of one minute and three attempts: a create, clone or copy that takes longer runs the stage again
  and fails the run. A cancel or SIGTERM before the turn starts is not heard (against ADR 0101).
- **Build:** heartbeat from the start of the stage to its end; listen for the cancel first and stop between the
  setup steps.
- **Done when:** scenarios prove a slow create and a slow copy-out send the prompt once, and a cancel during create
  stops the stage.

### [x] T-67 · no work is lost when the factory cannot be read for a moment (P0)

- **Problem:** a failed fetch of the factory's remote or a changed folder is a usage error, which the consumer
  acknowledges: the event is gone and no run exists (against SCN-FORE-082). After a fatal error at its start,
  `foreman serve` stays alive as a worker without an API.
- **Build:** "not readable now" is its own error: the event comes again, the API answers 503. A fatal start error
  ends the process with a code that is not 0.
- **Done when:** scenarios prove the event starts a run once the factory is readable, and a taken port ends serve.

### [x] T-68 · the console returns only to itself, and `osf init` keeps `.env` private (P1)

- **Problem:** `next` with a control character after the first slash leaves the console
  (`modules/console/src/domain/signin.ts`, `safeNext`). `osf init` writes secrets into an existing `.env` without
  setting its mode.
- **Build:** resolve `next` against the console's own origin; set mode 0600 on every write of `.env`.
- **Done when:** a scenario for each.

### [ ] T-69 · the merge gate covers the factory's branches, and unsigned records are said aloud (P1)

- **Problem:** `.github/gatekeeper/merge.rego` gates `observer/`, `factory/` and the label `factory`, but the
  foreman's branches are `osf/<run ID>`. `gatekeeper serve` writes unsigned records without a word, and neither
  profile gives it a signing key.
- **Build:** the policy gates `osf/`; serve warns once at its start without `GATEKEEPER_SIGNING_KEY`; `osf init`
  and the chart supply one.
- **Done when:** scenarios for the warning and the generated key; the policy's own test covers `osf/`.
- **Slices:**
  - [x] The policy gates `osf/` (SCN-GATE-115 runs gatekeeper with this repository's policy), serve warns once at
    its start without the key (SCN-GATE-113), and gatekeeper takes the key's seed in 64 hex digits (SCN-GATE-114).
  - [ ] After the release of gatekeeper with the hex seed: `osf init`, the profile and the chart supply the key.

### [x] T-70 · the profile runs no agent outside a sandbox (P1)

- **Problem:** an agent without `sandbox:` runs in the foreman's container with the foreman's environment.
- **Build:** a setting of the foreman refuses a stage whose agent has no sandbox; the Compose profile and the chart
  switch it on. The docker-proxy allows only what the sandbox adapter calls on its own containers and networks.
- **Done when:** a foreman scenario for the refusal, a deploy scenario for the profile's setting.
- **Done:** `FOREMAN_REQUIRE_SANDBOX=true` refuses such a factory at the start of the server, a run and a retry
  (SCN-FORE-186, SCN-DIST-056, SCN-DIST-057). The docker-proxy stays as it was: its rules match a request's method and
  path only, which cannot tell the sandboxes' containers from others (ADR 0096).

### [x] T-71 · no sandbox is left behind (P1)

- **Problem:** a sandbox's ID lives only in the activity's memory; nothing removes the sandbox of a foreman that
  died. `destroy` ignores exit codes. Each Docker sandbox takes one bridge network of a pool that ends near 30.
- **Build:** sandboxes carry the run and the owner as labels; the foreman removes its leftovers at its start, as
  ADR 0090 does for gateways; destroy fails when a removal fails; small subnets from a pool of the adapter's own.
- **Done when:** scenarios prove a leftover is removed at the next start and a failed removal is reported.
- **Done:** ADR 0158: the spec's `labels` and `list --label` (SCN-SANDBOX-031), `FOREMAN_SANDBOX_OWNER` with the
  sweep at the start (SCN-FORE-187 to SCN-FORE-189), set by the profile and the chart (SCN-DIST-058,
  SCN-DIST-059), and a destroy that reports a failed removal (SCN-SANDBOX-032). No subnets of the adapter's own: choosing free ranges
  safely next to the daemon's other clients is not simple; the docker adapter's README names Docker's
  `default-address-pools` for more than about 30 sandboxes per host.

### Stage CI · a pipeline that tells the truth

### [ ] T-72 · the deploy suite tests the commit (P0)

- **Problem:** the deploy suite starts released images only, so a change reaches it one release late, and the
  release commit pins versions that are not published yet: main was red after 8 of 8 releases.
- **Build:** on a pull request and on main the profile's and the chart's module images are built from the commit,
  as the e2e suite builds its image; `deploy` declares what it starts, so AFFECTED reruns it. One job after
  `publish-images` starts the released images. The release pull request passes verify without `--admin`.
- **Done when:** a change of a module that breaks a deploy scenario fails that pull request; a release merge is green.
- **Slices:**
  - [x] The decision record (ADR 0156), and the profile's module images from the commit in the deploy suite.
  - [x] The chart's scenarios on kind with the images from the commit; `kind-images.sh` goes.
  - [x] The job on the released images after publishing, which tells the maintainers when it fails (ADR 0169): the
    workflow `released-images` on `workflow_run` of `publish-images` and by hand, on the published commit;
    `scripts/images.ts` with `OSF_DEPLOY_IMAGES=released` pulls the images and checks amd64 and arm64; the Compose
    scenarios of `osf released-images scenarios` run (the chart's not yet); a failure opens or comments on one issue.
  - [ ] The release pull request: its dispatched verify green, and merged without `--admin`.

### [x] T-73 · a push to main never cancels the run before it (P1)

- **Build:** `verify.yml` cancels a running verify only for pull requests.

### [x] T-74 · BUDGET measures what a person waits for (P1)

- **Problem:** BUDGET sums the tests' times under parallel load, so it grows when a suite gets more workers and
  ends sooner, and its speed factor moves more than the budgets' margins (ADR 0103). It failed 11 of 21 failed
  pull-request runs; each time the budget was raised.
- **Build:** a decision record that supersedes ADR 0103; the budget is the wall time of a suite's test run with
  wide room, no factor; each `AGENTS.md` keeps one budget line, its history stays in Git.
- **Done when:** the scenarios of BUDGET are replaced, `testkit timed` writes the wall time, and no budget section
  is longer than three lines.

### [x] T-75 · a first push replays what main already proved (P1)

- **Problem:** main stores its test results under a hash with its own `OSF_TEST_RUN`, which no pull request has: a
  pull request's first push runs every suite (ADR 0081, ADR 0094).
- **Build:** main still runs everything, and stores the results under the hash a pull request computes. With it the
  Helm and Kubernetes suites run only for a change that reaches them.
- **Done when:** a pull request that changes one README starts no test runner on its first push.

### [x] T-76 · the Stop hook blocks or goes (P2)

- **Build:** the hook of `.claude/settings.json` ends with code 2 when `make check-fast` fails and does nothing on
  a clean tree; `factory.yaml` renders it.
- **Slices:**
  - [x] The hand-written hook ends with code 2 when `make check-fast` fails, does nothing on a clean tree, and blocks a
    stop once (`stop_hook_active`), so an agent that cannot fix a check can stop and ask.
  - [x] `factory.yaml` renders it: a field for a harness's stop check in `contracts/factory-definition` and in
    `factory render` (a contract change, plan mode first).

### [x] T-77 · fewer checks that do the same or nothing (P2)

- **Build:** FLAKE goes (every config sets `retry: 0`; a check keeps that true), DEPS and TODO go, NOSKIP and the
  static part of BOUNDARY-ENV join the one lint of the tests, and BOUNDARY-STATIC, ISOLATION and ARCH read the
  files in one pass. Their scenarios are deprecated with their tests. `docs/quality/checks.md` and `AGENTS.md` follow.
- **Done:** FLAKE is gone (`SCN-REPO-013` deprecated); AFFECTED keeps `retry: 0` in every Vitest config of a package
  with system tests (`SCN-REPO-191`). BOUNDARY-STATIC, ISOLATION and ARCH read one cruise (about 9.5 s to 2.7 s for
  the three); NOSKIP, ASSERT, UI-QUERY and BOUNDARY-ENV already shared one scan, which now wraps only the nodes it
  reads, and AFFECTED shares its parse (`osf check` about 15 s to 11 s). Kept: DEPS, since intake still pins
  `@electric-sql/pglite-prepopulatedfs` to its PGlite; TODO, since wave 7 ticks slices again and it catches a
  forgotten tick for nothing; NOSKIP, since PASS sees a `.fails` test as passed; the static BOUNDARY-ENV, since the
  testkit's guard does not see a variable a test sets in its own process, where a library's code runs.

### [x] T-78 · AFFECTED sees every folder a suite reads (P2)

- **Build:** `fakes.fromRepository(...)` and the folders `e2e/scripts/` reads count as inputs; the scenarios that
  pin lines of the Makefile word for word are deprecated.
- **Done:** `SCN-REPO-188` to `-190`: a folder of `fakes.fromRepository("<path>")` and a path from the root that a
  script of `test:system` reads must be in a declared package, a `$TURBO_ROOT$/` input of the package's `turbo.json`
  or `globalDependencies`; `e2e/turbo.json` and `tools/turbo.json` list theirs. The Makefile scenarios stay
  (`SCN-REPO-083`, `-084`, `-180`): each guards the hash of ADR 0081 and ADR 0154, which a change would break silently.

### [ ] T-79 · small suites share a runner (P2)

- **Build:** the suites with under 40 seconds of tests share two jobs; the kind jobs start their cluster sooner, so
  the deploy job's setup is under a minute.
- **Built:** ADR 0163, `SCN-REPO-205` to `-207`: `osf suite-plan` puts the nine suites with under 40 s of tests
  (measured: 870 s of runner time, 555 s of it setup) into two jobs; kind starts in the background right after the
  pinned tools, with a time on each line of its log. ADR 0167: the cache of the kind node image and the `pull` images
  is removed, because it made the deploy job's setup slower: 152 to 163 s with the cache, 89 and 107 s without it,
  118 s median before 0163. Open: the deploy setup is still over a minute; read the timed log of the background start
  and fix its largest part, then tick this item when the setup is under a minute.

### [x] T-80 · no run record by hand (P1)

- **Problem:** every agent pull request commits its session to `runs/` by hand (ADR 0027): 25 MB so far, and RUNS
  accepts any changed file.
- **Build:** a decision record that supersedes ADR 0027: RUNS no longer asks a pull request for a file, `make
  run-record` leaves the loop of `AGENTS.md` and the skills. ledger and scorekit keep reading what `runs/` holds.
- **Done when:** a pull request with an agent's trailer and no file in `runs/` passes. Done: ADR 0153,
  `SCN-REPO-177` (replaces `SCN-REPO-040`; `SCN-REPO-042` deprecated).

### Stage TR · the testing rule

### [x] T-81 · the testing rule, decided (P0)

- **Build:** a decision record that amends ADR 0007 and ADR 0074: one scenario, one test, from outside, with three
  additions. Scenarios that only read a system whose start takes more than about 10 seconds may share that start,
  each with its own `scenario()` and result, marked in the feature file. A family of "one input, one message" is a
  Scenario Outline. The wording of an implemented scenario may change in place when the behavior stays;
  `@replaces` is for behavior that changes or goes. `AGENTS.md`, `docs/quality/testing-strategy.md` and the skills
  `write-scenario` and `write-system-test` follow.

### [x] T-82 · one start of the profile and one install of the chart for the scenarios that only read (P1)

- **Build:** a shared form of `sut.compose` and `sut.helm` in the testkit; the deploy scenarios that only read use it.
- **Done when:** the deploy suite starts the whole profile once and installs the whole chart once.
- **Done:** `sut.shared` and the testkit's global setup run one start per test run (ADR 0162, SCN-TK-210 to -213);
  five scenarios share `@shared=compose-profile` and five `@shared=helm-chart`. The 30 profile scenarios took 55 s
  locally, down from 85 s; the chart's first proof is CI.

### [x] T-83 · spend-log reads as soon as the rows are there (P2)

- **Build:** measured, not built: `spend-log` keeps its fixed wait of 8 seconds. LiteLLM v1.106.2 has no way to
  ask whether a spend row is still queued or to write the queue now; a gateway writes it every 1 to 6 seconds, chosen
  at random when the proxy starts, so rows that are there say nothing about rows still in the queue.
- **Done:** measured, not worth it. Five of 36 scenarios wait the 8 seconds, 40 s of the 691 s of their summed time
  on 4 workers (242 s of wall time on the development container), so even no wait at all would save about 10 s of
  wall time, 4 %. The rows were complete 0.2 to 1.9 seconds after `spend-log` began in 8 calls. The shared gateway
  that ADR 0157 left to this item saves about 9 % and is not built either.

### [x] T-84 · Scenario Outlines, first for `factory lint` (P2)

- **Build:** an examples form of `scenario()` in the testkit; the `factory lint` family becomes Outlines.

### [ ] T-85 · the testkit's fakes are tested as a library (P2)

- **Build:** a fake's scenarios call it in the test's process (ADR 0039) instead of a demo module written as
  strings and a nested Vitest; the scenarios of the scenario runner itself stay as they are. One fake per pull request.
- **Done:** `fakes.forge`: SCN-TK-012, -049, -050, -080 to -082, -097 and -103 call it in the test's process
  (SCN-TK-101 keeps the nested run: it needs two scenarios). Measured back to back on the development container:
  the suite took 105.3 s instead of 117.8 s of wall time, the eight scenarios 23.0 s instead of 50.7 s summed.
  `fakes.github`: 27 of its 29 scenarios, with the client of `system-tests/github.ts` (SCN-TK-089 and -172 keep the
  nested run: the fake fails the nested test). `fakes.modelGateway`: 13 of its 15 (SCN-TK-007 fails the nested test,
  SCN-TK-120 needs a container that the module starts). Measured back to back: the suite took 96.3 s instead of
  118.7 s, the 27 scenarios 0.7 s instead of 40.0 s and the 13 scenarios 1.3 s instead of 19.7 s summed; budget 210 s.
  Left, by summed time of their scenarios before: `fakes.harness` (20.9 s, 13), `fakes.http` (15.2 s, 7),
  `fakes.postgres` (12.1 s, 4), `fakes.s3` (11.4 s, 2), `fakes.collector` (8.8 s, 2), `fakes.slack`, `fakes.nats`,
  `fakes.inference`, `fakes.sandbox`, `fakes.openbao`, `fakes.temporal`, `fakes.oidc`, `fakes.personIssuer`,
  `fakes.traceStore`, `fakes.sentry`.

### [ ] T-100 · spec-trace's report lists the changed rows of a Scenario Outline (P2)

- **Build:** the report of the spec-trace action names an Outline as changed when an Examples row changes, but not
  which row; it shows the rows added, removed and changed.

### [ ] T-101 · `spend-log` of an attached LiteLLM proxy waits long enough (P2)

- **Problem:** found in T-83. `spend-log` waits 8 seconds for the proxy to write its spend rows. A gateway that
  `start` runs writes them every 1 to 6 seconds; an attached proxy with LiteLLM's default writes every 10 to 15
  seconds, so the rows of the last calls can be missing.
- **Build:** the wait follows the proxy's write interval, or `attach` refuses a proxy whose interval the wait does
  not cover; the README says which.

### [ ] T-102 · `fakes.postgres` labels its containers per run (P2)

- **Problem:** found in T-85. SCN-TK-152 expects one container with the label `org.opensoftware.run=r8`; the label is
  the same in every run, so a second run on the same Docker host within a few seconds finds two and fails.
- **Build:** the scenario's run ID is unique per test run, or it counts only its own run's containers.

### Stage D · less weight

### [x] T-86 · status texts that are true (P1)

- **Build:** the README's status, tools table and scenario count; the glossary's "run" (the foreman's pass over a
  work item) and "session"; `docs/explanation/bootstrapping.md`; the principles and `docs/architecture/` say what
  is built and what is planned; the finished items of this file move to `docs/history/`.

### [x] T-87 · `checks.md` and the skills, readable and without contradictions (P2)

- **Build:** one line per check in the tables and a short section per check; one pass over the ten skills, with
  every case to stop and ask in one list of `AGENTS.md`.
- **Done:** `docs/quality/checks.md` has one line per check with where it runs, and a section per check with what it
  reads, what fails and the fix, true to `tools/checks/`; the skills link to `AGENTS.md` instead of repeating it, and
  its "When to stop and ask" holds every case the skills named.

### [x] T-88 · a package earns its place (P1)

- **Problem:** 34 npm packages for about 42,000 lines of source; four harness adapters of 21 to 109 lines each
  have a package, a publish workflow and a changelog of their own.
- **Build:** a decision record that amends ADR 0135: a new package needs a job of its own, a second consumer or a
  reason to be installed alone, and a size that carries a release; a small shared piece joins an existing library.
  `AGENTS.md`, the skills `new-module` and `write-adr` say so, and DUP's rule "no clone across units" names the
  existing libraries as the place for shared lines.
- **Done when:** the rule is in `AGENTS.md`, and a check or the ADR check asks a new package for its reason. Done:
  ADR 0159; the ADR check asks a new published package for `## Why a package` (`SCN-REPO-192`, `SCN-REPO-193`); DUP
  counts a clone of at most 15 lines across units under each unit's limit (`SCN-REPO-194`, `SCN-REPO-195`).

### [ ] T-89 · one harness package (P2)

- **Build:** `@opensoftware/harness` with the commands of acp, claude-code, codex and opencode and the library
  harness-proxy; the old names are deprecated on npm with a pointer. Profile, chart and factories follow.

### [ ] T-90 · one channel package, and `postgres` in a shared library (P2)

### [x] T-91 · an index of the decisions that last (P2)

- **Build:** `docs/decisions/README.md` lists the durable decisions; records of test and CI mechanics are marked
  as design notes; ADR 0001 allows a status line to change; 0003, 0016, 0049 and 0093 get their notes.
- **Done:** ADR 0161: every record names a `topic:` (`design-note` for test and CI mechanics), which the ADR check
  requires (SCN-REPO-200); `make docs` writes the index by topic, the design notes and the superseded records apart,
  and DOCS-GEN keeps it current (SCN-REPO-201). ADR 0001 lets a status line and a topic change; 0003, 0016, 0049
  and 0093 name the records that changed them.

### [ ] T-92 · `init`, `up` and `doctor` are commands of `factory` (P2)

- **Found:** the three are commands of `osf` (`tools/scaffold/setup.ts`, ADR 0119), which runs only in a clone.
  As commands of `factory` they would give factory-spec a second job, and the Compose profile they work on is not
  published.
- **Owner's decision:** keep `osf` and close this item; or publish a package `@opensoftware/profile` with the
  profile and the three commands, so that `npx` works without a clone (recommended; it meets ADR 0159); or make
  `factory` an umbrella CLI and rename factory-spec's binary, a breaking change over several pull requests.

### [x] T-93 · test hooks are no product settings (P2)

- **Build:** `OSF_NOW`, `OSF_SEED` and the intervals only tests set are honored only with an explicit test switch
  and are listed apart from the configuration.
- **Done:** ADR 0166: the eight units that read `OSF_NOW` or `OSF_SEED` (gatekeeper, foreman, console, intake, proof,
  runlog, scorekit, channel-slack) read them with `testHook` of `@opensoftware/cli`, which refuses a hook without
  `OSF_TEST_HOOKS=1` with exit code 2 and its name (SCN-CLI-021 to 023, SCN-GATE-118, SCN-FORE-197, SCN-CONSOLE-282);
  the testkit sets the switch (SCN-TK-214) and the profile does not (SCN-DIST-072); `make docs` lists the hooks under
  "Test hooks" (SCN-REPO-215). The intervals the tests shorten are settings an operator tunes, so they stay; the one
  without a check, `GATEKEEPER_POLL_MS`, now needs a whole number of 1 or more (SCN-GATE-119).

### Stage E · ready for phase 3

### [x] T-94 · a sandbox that can check this repository (P0)

- **Build:** a template image for this repository's factory with pnpm and the pinned tools; the prompts of
  `deploy/dogfood/factory/` ask for `make check-fast` and leave the suites to CI.
- **Done:** ADR 0164: the image `dogfood-agent` of the service `dogfood-template` (profile `dogfood`), the agents'
  template with pnpm 10.28.0, lychee 0.20.1 and `TURBO_CONCURRENCY=4`, 1.12 GB (SCN-DIST-070); every agent of the
  factory starts from it, and its prompts ask for `make check-fast` (SCN-DIST-071). In it, `make check-fast` of every
  package took 92 s with 4 CPUs and 8 GiB, and 167 s with 2 CPUs and 4 GiB, after a build of 28 s and 52 s.

### [ ] T-95 · a rehearsal on GitHub (P0)

- **Build:** the six stages of this repository's factory on a scratch repository on GitHub with the scripted agent,
  started by a maintainer: issue, spec, gate on the pull request, implement, checks, ship.

### [x] T-96 · ledger tells factory pull requests from people's (P1)

- **Build:** the share of merged pull requests from the factory and the revert rate of each group, the two numbers
  of phase 3's exit criterion.

### [x] T-97 · a limit on runs side by side (P2)

- **Built:** `FOREMAN_MAX_STAGES` limits the stages with an agent that one foreman runs at once, on a task queue of
  the stages (ADR 0160); a waiting stage shows `blocked` in `GET /v1/runs/<id>`; the number settings refuse a value
  that is not a whole number; the profile and the chart set 2 (SCN-FORE-190 to 192, SCN-DIST-061, SCN-DIST-062).

### [x] T-98 · a failed check sends the run back to implement once (P2)

- **Done:** a stage with checks may name `rework: <stage>`, an earlier stage with an agent; a failed check sends the
  run back to it once, with the failed checks' names, states, descriptions and links in its prompt, the stage keeps
  its gate's approval, `GET /v1/runs/<id>` shows its `rework` and `run.completed@v1` lists it in `reworks`; a second
  failure fails the run as before; `factory lint` and `foreman serve` refuse a `rework` that cannot work (ADR 0165,
  SCN-FORE-193 to 196, SCN-FSPEC-130, SCN-FSPEC-131). Open: this repository's factory names `rework: implement` on
  its stage `verify` once a release carries the field.

### [ ] T-99 · the factory's own identity on GitHub (owner's decision)

- **Problem:** the agents push and comment with the owner's token, and the owner is the only approver: a comment
  of an agent would count as the owner's.
- **Build:** after the owner chose a GitHub App or a second account.

---

## After the plan: phase 3 and 4

When T-17 is done, follow `docs/explanation/bootstrapping.md`: the factory implements this repository's
`factory` issues with people at the gates, then observer improves our own `factory.yaml`. In phase 3 the factory
implements an issue labeled `factory` of this repository and opens its pull request, and a person reviews and merges
it; that run is not part of T-21. Add each new requirement as a vision scenario first, then as module scenarios and
a new item here.

Vision for later, not this plan (the owner's choice): once the factory's basic features are exposed in its UI, the
factory learns from its own work. The job `observe` of `weekly-paid.yml` already runs `observer analyze`, `observer
propose` and `observer check` on the weekly scores (ADR 0046, ADR 0077); phase 4 starts with the first merged observer
pull request whose effect `observer check` measures, on 20 scored runs before and after its merge.
