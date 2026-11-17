---
status: accepted; since the second slice of T-72 scripts/images.ts also loads the chart's images into kind, and kind-images.sh is gone (deploy/README.md); amended by 0169 (OSF_DEPLOY_IMAGES=released pulls the released images for the job after publish-images)
topic: design-note
date: 2026-11-16
---

# 0156. The deploy suite builds the module images from the commit

## Context

The deploy suite started the released module images at the pins of `deploy/compose/compose.yaml`, and its
`package.json` declared only the testkit, so a change of a module never reran it. A behavior change reached the suite
one release late: pull request #365 changed the console's Content-Security-Policy and stayed green, and SCN-DIST-036
failed only after release #358. The release pull request moves the pins to versions that npm does not serve yet, so
building a missing image from npm ended with `npm error notarget`: verify failed on main after 8 of 8 release merges,
and the release pull requests were merged with `--admin` (TODO.md T-72).

ADR 0074 and ADR 0075 chose images from npm because an image from the workspace would not match what users install.
ADR 0076 built one workspace image for the e2e suite, which differs from the released images in more than the source
of its packages: one image for every module, the full Node image, no `gh`, `make` or `kubectl`.

## Decision

- **The same Dockerfile, one step swapped.** `deploy/scripts/images.ts` writes a copy of `deploy/images/Dockerfile`
  into the ignored folder `deploy/images/.workspace/`, in which the one step `npm install --global ... $PACKAGES`
  installs the same packages from packs of the workspace (`deploy/scripts/install.mjs`, in `/opt/osf`, with their
  commands linked into `/usr/local/bin`). Every other line, stage and build argument is the Dockerfile's own, so the
  targets `module`, `gatekeeper`, `agent` and `foreman` keep their tools. `deploy/images/Dockerfile` itself does not
  change, and publish-images keeps building it from npm.
- **The pinned tags.** The script bakes every target of `compose.yaml` that installs `PACKAGES` with
  `docker buildx bake`, as publish-images does, and loads the images under their pinned tags. Compose and the chart
  find them locally; `compose.yaml`, `values.yaml` and the scenarios stay as they are.
- **Before the tests.** `test:system` of `deploy` is `node scripts/images.ts && testkit timed vitest run`, so the
  build is outside the time that BUDGET reads, as in e2e.
- **The turbo hash.** `deploy/package.json` declares every package that `compose.yaml` installs; PROFILE checks it.
  A change of one of them reruns the deploy suite. `e2e/package.json` declares `@opensoftware/deploy`, whose Compose
  file the e2e profile includes.
- **One packer.** `deploy/scripts/packs.ts` packs named packages with their workspace dependencies; the e2e suite
  imports it, so the code is in one place and no new package exists for it.
- This slice changes the Compose scenarios only. The chart's scenarios on kind still get the images that
  `deploy/helm/kind-images.sh` pulls, until the next slice of T-72 loads the images of the commit into kind. A job
  after publish-images proves the released images, in a later slice.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A copy of the Dockerfile with the install step swapped (chosen) | the released Dockerfile stays byte for byte, so no image needs a new tag; every stage and tool is the same | the copy must find the install step; the script fails when it does not |
| A `SOURCE` build argument in the Dockerfile | one file | the changed `module` stage gives every module image a new `-r` tag under PROFILE, published only at the next release |
| e2e's one workspace image for every module | exists | not the images of the profile: no `gh`, `make`, `kubectl`, one image for all |
| A local npm registry such as Verdaccio | the install runs exactly as from npm | a new service in CI; the Dockerfile would still need a registry argument |
| An override file that points the services at other images | no retagging | SCN-DIST-041 and the chart read the pinned image names; every chart scenario would need other values |

## Prior art

- [docker buildx bake](https://github.com/docker/buildx) (Apache-2.0, active): already the builder of publish-images
  (ADR 0075). Adopted: `--set '*.dockerfile=...'` builds the targets of `compose.yaml` from the copy.
- [pnpm pack](https://pnpm.io/cli/pack) and npm `overrides` (MIT, active): already the e2e image's way (ADR 0076).
  Adopted.
- [Verdaccio](https://github.com/verdaccio/verdaccio) (MIT, active): checked, not adopted, for the reason in the table.

## Consequences

- A module change that breaks a Compose scenario fails its own pull request. The deploy suite runs on more pull
  requests: every change of a package that an image installs.
- Locally, the images of the commit carry the registry's tags and hide the released ones until
  `docker compose pull`. CI runners start empty.
- The images of the commit differ from the released ones in how npm laid out the packages (`/opt/osf` instead of the
  global folder). The job on the released images of a later slice proves what users get.
- Measured on the development container (4 cores, the base images present): the seven module images built in 67
  seconds from no cache, and in seconds when the packs did not change, as `pnpm pack` writes the same bytes.
