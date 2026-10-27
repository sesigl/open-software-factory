---
status: accepted
date: 2026-10-27
---

# 0076. The end-to-end smoke suite on the Compose profile

## Context

TODO item T-20 asks for the five scenarios of `e2e/features/smoke.feature` on the Compose profile (ADR 0074) with
the testkit's fakes. Each scenario crosses several modules: a Slack request becomes a pull request with evidence, a
gate waits for a maintainer, the observer proposes a fix, a benchmark becomes a routing rule, and a manual change of
a webhook shows as drift. The profile builds its module images from npm releases, so a change of a module would
reach the suite only after its release. The suite must test the commit under review, must not call a real model,
Slack or GitHub, and must finish in minutes on a CI runner.

## Decision

- `e2e/` is a unit of the repository like `deploy/`: the private package `@opensoftware/e2e` with the scenarios in
  `e2e/features/` (prefix `SCN-E2E`) and their system tests in `e2e/system-tests/`. It has no code in `src/`.
- **One image of the workspace.** `e2e/scripts/images.ts` packs every program of the factory and its workspace
  dependencies with `pnpm pack`, and `e2e/images/Dockerfile` installs those tarballs with npm into one image
  `osf-e2e:workspace` (Node 24 with Git and curl, and OPA). `test:system` builds it before the tests; Docker's
  cache makes a second build take seconds. Each module service runs its own command in it.
- **The profile, changed by an override.** `e2e/compose/compose.yaml` includes `deploy/compose/compose.yaml` and
  `e2e/compose/override.yaml`, which Compose merges like `-f` files. The override points every module service at the
  workspace image, sets the fixed clock `OSF_NOW`, and wires the fakes. Nothing of the profile is copied.
- **The fakes run on the Docker host.** The testkit's fake Slack, scripted model gateway and JSON API get the option
  `containers: true`: they listen on every interface and give a `containerUrl` on `host.docker.internal`, which the
  override maps to the host gateway. Forgejo is the testkit's forge container.
- **The scripted agent runs in foreman's container.** `fakes.harness(turns, { containers: true })` gives the agent's
  code folder and its script folder as `mounts`; the override mounts both at the same paths, and foreman starts the
  agent with `harness-acp run`. A turn's new `commands` run in the agent's folder like a coding agent's tools, so the
  implement turn clones, pushes and opens a pull request on Forgejo, and the verify turn attaches proof's evidence.
- **The tools run with `docker compose run`.** observer and taskcapture are services of the profile `tools` in the
  override, with a work folder of the scenario as `/work`. The benchmark's Harbor is a scripted stand-in in that
  folder that asks the scripted model gateway; the profile's LiteLLM serves the config that `taskcapture route` wrote.
- intake replies in the Slack thread of a work item with the pull request of its completed run
  (`SCN-INTAKE-039`), so a person sees the result where they asked.
- CI runs the suite as the `e2e` suite of `verify.yml` on every pull request and every merge to `main`.
- `SMOKE-PAID`, the nightly run with real models, is not part of this decision: it needs paid calls, which the owner
  approves first.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| One image from workspace packs (chosen) | tests the commit under review; one build for every module; npm installs the packs as users install releases | the image differs from the released images in its versions |
| The profile's images from npm pins | the images users get | a module change reaches the suite only after its release |
| One image per module from the workspace | closer to the released images | thirteen builds; minutes more per run |
| A copy of the profile for the tests | free to change | drifts from the profile; the scenarios would not test what operators run |
| The fakes in containers on the project's network | no host gateway | the testkit's fakes are in-process servers whose state the test reads; a container would need an API for that |
| The agent as a container of its own | closer to a remote harness | foreman starts harnesses as processes (ADR 0053); it would need a new launcher |
| `inference-litellm start` for E2E-004, as T-20 suggested | the adapter's own way | a second LiteLLM next to the profile's; the profile's LiteLLM runs the same image and config format |

## Prior art

- [Docker Compose `include`](https://docs.docker.com/compose/how-tos/multiple-compose-files/include/) (Apache-2.0,
  active): includes another project's file and merges a list of files like `-f`; `!reset` drops a key of the
  included file. Adopted for the override.
- [pnpm pack](https://pnpm.io/cli/pack) (MIT, active): packs a workspace package with `workspace:` versions replaced
  by real ones. Adopted; npm `overrides` point the packs' dependencies at each other.
- [Testcontainers for Node](https://github.com/testcontainers/testcontainers-node) (MIT, active): already the
  testkit's container library and the base of `fakes.forge()`. Its `host.testcontainers.internal` port forwarding
  was checked for the fakes and not chosen: `host-gateway` needs no extra container.
- [LiteLLM](https://github.com/BerriAI/litellm) (MIT, active): the profile's gateway; tag routing with
  `enable_tag_filtering` is what `taskcapture route` writes (ADR 0043).
- [Harbor](https://harborframework.com) (Apache-2.0, active): the benchmark runner of taskcapture (ADR 0045). The
  suite replaces it with a scripted stand-in, as taskcapture's own tests do, because a real Harbor run needs a model.

## Consequences

- A change of any module is tested end to end before its release. `make smoke` runs the suite locally; it needs
  Docker.
- The suite takes about three minutes on a laptop: the profile starts once per scenario, LiteLLM with its database
  for E2E-004 the longest.
- The testkit has three new options (`containers` for Slack, the harness and the model gateway) and turn
  `commands`; they serve any unit that tests containers.
- `SMOKE-PAID` stays open in T-20 until the owner approves its nightly paid calls.
