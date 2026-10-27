# AGENTS.md for `deploy`

Adds rules for the distribution. The root `AGENTS.md` applies in full.

## Public surface

The only ways a system test or an operator may use the distribution:

- The Compose profile: `docker compose` in `compose/`, with `compose/.env` (see `README.md#configuration`)
- The reference factory in `compose/factory/`
- The image build `images/Dockerfile`, with the build argument `PACKAGES`

System tests drive the profile with `sut.compose("compose/compose.yaml")` and reach the services only through their
published ports and `docker compose run`.

## Rules

- Pin every image to an exact tag and every npm package to an exact version.
- Never write a secret into a file of this folder: `.env` holds them and is ignored by Git.
- A service that others wait for has a health check, so `docker compose up --wait` means the factory is ready.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 420 seconds in total on the CI runner. SCN-DIST-001, -003 and -004 each start the profile, about 40
  seconds with built images; the first one builds the module images from npm, about 60 seconds more.

## Scenario prefix

`SCN-DIST-NNN`
