---
status: accepted
topic: design-note
date: 2026-11-17
---

# 0169. The released images run the deploy scenarios after each publish, and an issue tells the maintainers

## Context

Since ADR 0156 the deploy suite on a pull request and on main starts the module images built from the commit. Nothing
started the images that `publish-images` pushed to GHCR: an image that the release runner built wrong, one without
arm64, or a pin in `compose.yaml` that names no published tag would be noticed only by a user. These images differ
from the commit's in how npm installed their packages (the global folder from npm in place of `/opt/osf` from packs),
so a pass of the commit's images says little about them. The third slice of T-72 asks for a job after publishing that
starts the released images and tells the maintainers when they fail. The repository has no paid service for alerts,
and no address of a person may be written into it.

## Decision

- **After publish-images, on its commit.** A workflow `released-images` runs on `workflow_run` of `publish-images`
  when that run succeeded, and by hand with `workflow_dispatch` and an optional `ref` (a tag or commit, default the
  head of main). It checks out `github.event.workflow_run.head_sha`, the commit that `publish-images` published, so it
  starts the pins of the release, not of main's head. A failed publish shows in its own red run and does not start it.
  A separate workflow and not a last job of `publish-images`: publishing stays one job that a test failure never
  marks red, and a maintainer can start the check alone.
- **The released images, pulled.** `deploy/scripts/images.ts` takes `OSF_DEPLOY_IMAGES`: `commit`, the default,
  builds as ADR 0156 says; `released` builds nothing and pulls each image of the factory's registry that the bake
  targets of `compose.yaml` name, after it checked that the registry's index has the image for `linux/amd64` and
  `linux/arm64`, the platforms of `publish-images`. A pull replaces an image of the commit with the same tag. Any other
  value fails. `--dry-run` prints the pulls and pulls nothing (SCN-DIST-080, SCN-DIST-081).
- **The Compose scenarios only.** `osf released-images scenarios` lists the system tests to run: every implemented
  scenario of `deploy/features/` except the chart's in `helm.feature`, and except a scenario tagged `@images=commit`,
  which proves the commit's images (SCN-DIST-053, SCN-DIST-060; SCN-REPO-220). The chart's scenarios need a kind
  cluster with agent-sandbox, the cached node image and the suite's `pull` list, the setup of `verify.yml` and
  `.github/scripts/kind-start.sh`; repeating it here costs a second copy of that setup, so the chart stays out until a
  later change needs it. With a kind cluster in the kube context, `images.ts` already loads the pulled images into it.
- **Outside the test cache and BUDGET.** The job runs `vitest run` with the listed files in `deploy/`, not
  `make verify-tests` or turbo: it reads and writes no entry of the cache `turbo-tests-` that pull requests replay
  (ADR 0081, ADR 0154), sets no `OSF_TEST_CACHE` and writes no `reports/run-time/` file that BUDGET reads (ADR 0155).
  AFFECTED now fails any workflow that sets `OSF_TEST_CACHE` outside pull requests, and any workflow besides
  `verify.yml` that writes the cache `turbo-tests-` (SCN-REPO-224).
- **One issue tells the maintainers.** When a step fails, the job opens the issue "The released images fail the
  deploy scenarios" with the run's link, the released commit and the IDs of the scenarios that failed in the JUnit
  report, or comments the same on that issue while it is open. When a later run passes and the issue is open, it
  comments that the run passed; a person closes the issue. It uses the job's `GITHUB_TOKEN` with `issues: write` and
  `gh issue`; GitHub notifies the people who watch the repository. `osf released-images report` writes the texts
  (SCN-REPO-221 to SCN-REPO-223), so the YAML holds only the `gh` calls.

The defaults that the owner left open and may change: the trigger (`workflow_run` of a successful `publish-images`,
plus `workflow_dispatch`), Compose only, the issue's title and that it is never closed by the job.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A workflow on `workflow_run` of publish-images (chosen) | runs on the published commit; publishing stays green when the check fails; a maintainer can start it alone | `workflow_run` runs only the file on the default branch, so a change of it takes effect after merge |
| A last job of publish-images | one workflow | a failed scenario marks the publish red, though every image is published; a rerun publishes nothing new |
| A nightly run | catches a registry that changed later | the release that broke is a day old when it fails; the profile's pins move only with releases |
| The Helm scenarios on kind too | covers the chart | a second copy of the kind setup of verify.yml, which another change is reworking; 10 to 20 more minutes |
| An e-mail or chat alert | direct | a paid or extra service, or a person's address in the repository |
| `docker compose pull` in place of a switch of images.ts | one command | also pulls every third-party image; checks no platform; the chart's load into kind would not see the switch |

## Prior art

- GitHub Actions [`workflow_run`](https://docs.github.com/actions/reference/events-that-trigger-workflows#workflow_run)
  and the [`gh` CLI](https://github.com/cli/cli) (MIT, active), both already used here. Adopted.
- [docker buildx imagetools](https://github.com/docker/buildx) (Apache-2.0, active), which publish-images uses to find
  published tags. Adopted to read an image's platforms.
- Actions that open an issue on failure, such as `JasonEtco/create-an-issue` (MIT): checked, not adopted; a
  third-party action with the token for what two `gh` commands do.

## Consequences

- A broken published image, a missing architecture or a pin without a published tag opens one issue after the
  release, with the scenarios that failed. Only the first release after the merge proves the trigger, the checkout of
  the published commit and the `gh issue` calls with the job's token; a maintainer can run it by hand before.
- Each successful run of publish-images starts a runner for about 15 to 30 minutes, also when it published nothing new.
- A new scenario that holds only for the commit's images needs the tag `@images=commit`, or it fails here.
- ADR 0156 said that a later slice proves the released images; this record is that slice and amends it.
