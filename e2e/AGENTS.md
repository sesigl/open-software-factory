# AGENTS.md for `e2e`

Adds rules for the end-to-end smoke suite. The root `AGENTS.md` applies in full. Decision: ADR 0076.

## Public surface

The only ways a system test may use the factory:

- The Compose profile with the override: `docker compose` in `compose/`, with the scenario's `.env` (see
  `README.md#configuration`), through `sut.compose("compose/compose.yaml")`
- The services' published ports and their documented APIs, and `docker compose run` of the tools
- The testkit's fakes, which the modules reach at their containers' URLs

Never import a module, read a module's database or volume, or exec into a container.

## Rules

- Change the profile only through `compose/override.yaml`; never copy a service of `deploy/compose/compose.yaml`.
- Every scenario writes its own `factory.yaml`; the shared files in `factory/` hold only what every scenario uses.
- Pin every image to an exact tag.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 600 seconds in total on the CI runner. Each scenario starts the profile, about 20 seconds with the
  images the CI job loaded before; SCN-E2E-004 also starts LiteLLM with its database, about 80 seconds.

## Scenario prefix

`SCN-E2E-NNN`
