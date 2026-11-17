# AGENTS.md for `deploy`

Adds rules for the distribution. The root `AGENTS.md` applies in full.

## Public surface

The only ways a system test or an operator may use the distribution:

- The Compose profile: `docker compose` in `compose/`, with `compose/.env` (see `README.md#configuration`)
- The reference factory in `compose/factory/` and this repository's factory in `dogfood/factory/`
- The image build `images/Dockerfile`, with the build argument `PACKAGES`
- `scripts/images.ts`, which builds the module images of `compose.yaml` from this workspace under their pinned tags
  before the tests (ADR 0156) and loads the chart's images into a local kind cluster, or with
  `OSF_DEPLOY_IMAGES=released` pulls the published ones (ADR 0169); it is the package's `bin`, so a system test runs
  it with `sut.cli`. And `scripts/packs.ts`, the packer that the e2e suite shares
- The Helm chart: `helm` with `helm/osf/` and a values file (see `README.md#helm-values`), and `helm test`

System tests drive the profile with `sut.compose("compose/compose.yaml")` and reach the services only through their
published ports and `docker compose run`. They drive the chart with `sut.helm("helm/osf")` and reach the services only
through `kubectl port-forward` (`url`), `helm test` and the state of the workloads. A scenario that only reads the
whole profile or the installed chart takes it from `sharedProfile` or `sharedChart` of `system-tests/`, with the tag
`@shared=compose-profile` or `@shared=helm-chart`; one that changes it for everyone, or needs other settings, starts
its own.

## Rules

- Pin every image to an exact tag and every npm package to an exact version.
- `compose.yaml` is the one list of module images and their packages. The chart's `images.*` tags equal its pins.
- Each release moves the pins: the release workflow runs `osf profile-pins` in the release pull request, and PROFILE
  fails on a pin that is not the released version (ADR 0095). Do not edit a pin by hand.
- A published image tag never changes: a new adapter pin without a new module version takes `<version>-r<n>`.
- The scenarios of the profile and of the chart start the images of the commit, which `scripts/images.ts` builds from
  a copy of `images/Dockerfile` with its install step swapped (ADR 0156) and loads into kind. Keep that step one `RUN`
  with `npm install --global ... $PACKAGES`, which the script finds; `package.json` declares every package that
  `compose.yaml` installs, and PROFILE checks it. Keep `images.pullPolicy` at `IfNotPresent`, so kind keeps them.
- The workflow `released-images` runs the scenarios on the published images after each publish (ADR 0169). Tag a
  scenario that holds only for the images of the commit, like SCN-DIST-053, with `@images=commit`, after its other
  tags, so that job leaves it out.
- A change to the chart moves its version in `Chart.yaml`; PROFILE compares with the base.
- The chart shares the reference factory and Temporal's configuration with the profile through the links in
  `helm/osf/files/`; never copy them.
- Never write a secret into a file of this folder: `.env` holds them and is ignored by Git.
- A service that others wait for has a health check, so `docker compose up --wait` means the factory is ready.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 340 seconds of wall time on the CI runner.
- Most of it: one chart install on kind and one start of the Compose profile, shared by five scenarios each
  (ADR 0162), 40 to 90 s each; locally the profile's scenarios took 55 s, down from 85 s. Lower it after CI measured it.

## Scenario prefix

`SCN-DIST-NNN`
