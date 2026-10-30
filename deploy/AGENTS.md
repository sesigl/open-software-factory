# AGENTS.md for `deploy`

Adds rules for the distribution. The root `AGENTS.md` applies in full.

## Public surface

The only ways a system test or an operator may use the distribution:

- The Compose profile: `docker compose` in `compose/`, with `compose/.env` (see `README.md#configuration`)
- The reference factory in `compose/factory/`
- The image build `images/Dockerfile`, with the build argument `PACKAGES`
- The Helm chart: `helm` with `helm/osf/` and a values file (see `README.md#helm-values`), and `helm test`

System tests drive the profile with `sut.compose("compose/compose.yaml")` and reach the services only through their
published ports and `docker compose run`. They drive the chart with `sut.helm("helm/osf")` and reach the services only
through `kubectl port-forward` (`url`), `helm test` and the state of the workloads.

## Rules

- Pin every image to an exact tag and every npm package to an exact version.
- `compose.yaml` is the one list of module images and their packages. The chart's `images.*` tags equal its pins.
- A published image tag never changes: a new adapter pin without a new module version takes `<version>-r<n>`.
- The chart shares the reference factory and Temporal's configuration with the profile through the links in
  `helm/osf/files/`; never copy them.
- Never write a secret into a file of this folder: `.env` holds them and is ignored by Git.
- A service that others wait for has a health check, so `docker compose up --wait` means the factory is ready.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 600 seconds in total on the CI runner. SCN-DIST-001, -003 and -004 each start the profile, about 40
  seconds with the images the CI job loaded before. SCN-DIST-007, -009, -010 and -011 each install the chart on kind,
  about 90 seconds. SCN-DIST-014 starts only intake with PostgreSQL and NATS, about 10 seconds.

## Scenario prefix

`SCN-DIST-NNN`
