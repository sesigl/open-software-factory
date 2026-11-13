# AGENTS.md for `deploy`

Adds rules for the distribution. The root `AGENTS.md` applies in full.

## Public surface

The only ways a system test or an operator may use the distribution:

- The Compose profile: `docker compose` in `compose/`, with `compose/.env` (see `README.md#configuration`)
- The reference factory in `compose/factory/` and this repository's factory in `dogfood/factory/`
- The image build `images/Dockerfile`, with the build argument `PACKAGES`
- The Helm chart: `helm` with `helm/osf/` and a values file (see `README.md#helm-values`), and `helm test`

System tests drive the profile with `sut.compose("compose/compose.yaml")` and reach the services only through their
published ports and `docker compose run`. They drive the chart with `sut.helm("helm/osf")` and reach the services only
through `kubectl port-forward` (`url`), `helm test` and the state of the workloads.

## Rules

- Pin every image to an exact tag and every npm package to an exact version.
- `compose.yaml` is the one list of module images and their packages. The chart's `images.*` tags equal its pins.
- Each release moves the pins: the release workflow runs `osf profile-pins` in the release pull request, and PROFILE
  fails on a pin that is not the released version (ADR 0095). Do not edit a pin by hand.
- A published image tag never changes: a new adapter pin without a new module version takes `<version>-r<n>`.
- A change to the chart moves its version in `Chart.yaml`; PROFILE compares with the base.
- The chart shares the reference factory and Temporal's configuration with the profile through the links in
  `helm/osf/files/`; never copy them.
- Never write a secret into a file of this folder: `.env` holds them and is ignored by Git.
- A service that others wait for has a health check, so `docker compose up --wait` means the factory is ready.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 660 seconds in total on the CI runner. SCN-DIST-003, -004, -017, -022 and -026 each start the
  profile with Compose, 56 to 67 seconds with the images the CI job loaded before. SCN-DIST-009, -010, -019 and -021
  each install the chart on kind, 47 to 57 seconds. SCN-DIST-014 starts only intake with PostgreSQL and NATS, about
  10 seconds.
- Measured for 660 s: these nine scenarios are about 525 s of the suite. In four CI runs the suite took 568 s to
  715 s of raw time, and 433 s to 619 s at BUDGET's measure; the 619 s came from the fastest raw run (568 s), whose
  CPU benchmark took 0.918 times the reference. The suite waits on Docker and kind I/O, which the CPU benchmark does
  not follow, so the budget keeps about 7% above the highest measure.

## Scenario prefix

`SCN-DIST-NNN`
