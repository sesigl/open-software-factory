---
status: accepted
date: 2026-11-14
---

# 0119. Setup commands around the Compose profile

## Context

T-30. A new team that clones this repository reaches a running factory through six manual steps in the quick start of
`deploy/README.md`: copy `.env.example`, invent five secrets that only the factory's own services share, choose Slack
or a forge token for gatekeeper, put a person in `groups.json`, `docker compose up`, `console doctor`. A secret left
empty fails deep inside `docker compose up`; gatekeeper without a channel fails only when it starts.

## Decision

`osf`, the repository's own tool, gets three thin commands around the Compose profile in `deploy/compose/`:

- **`osf init [--factory <dir>]`** writes `.env` from `.env.example` when there is none. It fills each empty
  `*_PASSWORD`, `*_API_TOKEN` and `*_MASTER_KEY` with 32 random bytes in hex after the example's prefix (`sk-` for
  LiteLLM): these secrets are shared only between the factory's services, so nobody needs to choose them. Every other
  value, such as Slack, forge and model tokens, stays empty for the team; the command lists them. `.env` is written
  with mode 600 and stays ignored by Git. An existing `.env` is never changed. `--factory <dir>` copies the
  reference factory to the team's folder and points `FACTORY_DIR` at it, so the team edits its own copy, not the
  reference.
- **`osf up`** checks `.env` first: it exists, every `${NAME:?...}` of `compose.yaml` has a value, and gatekeeper
  has the three Slack values or `GATEKEEPER_FORGE_TOKEN`. Then it runs `docker compose up --detach --wait` in
  `deploy/compose/`.
- **`osf doctor`** runs `docker compose run --rm console console doctor` there and exits with its code: the checks
  stay in console (ADR 0086), in one place.

The three commands load only Node's own modules, so they run on a clone with Node 24 and Docker, before
`make install`. `OSF_DOCKER` names the docker command, so their scenarios run with a fake one and without Docker. The
tutorial `docs/tutorials/first-run.md` describes the first run with them; the quick start keeps the plain Compose
commands, which do the same.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Only the Compose commands and a tutorial | Nothing new to maintain | The secrets and the gatekeeper channel stay the first-run traps |
| Three commands in `osf` around Compose (chosen) | No new tool; checks the `.env` before Compose starts; testable without Docker | A clone needs Node 24 as well as Docker |
| A new published `osf-setup` package or an installer script | Runs without the clone | A new package to release for three steps; the profile lives in the clone anyway |
| `factory init` of factory-spec | Already writes a factory | It writes `factory.yaml` for a repository, not the profile's `.env`; it would have to know Compose |

## Prior art

`docker compose` itself has no step that generates secrets. Sentry's `self-hosted` `install.sh` generates its secret
key in a script before `docker compose up`, and Mastodon's `mastodon:setup` task asks for its values; both are
maintained, and both are tied to their own product, so there is nothing to adopt. We follow the same pattern in the
tool this repository already has. No new dependency: the commands use Node's `crypto`, `fs` and `child_process`.

## Consequences

A new team runs `osf init`, fills what it lists, `osf up` and `osf doctor`. A new required variable in
`compose.yaml` is checked by `osf up` without a change to it; a new secret of the factory's own services is
generated when its name ends in `_PASSWORD`, `_API_TOKEN` or `_MASTER_KEY`. The Helm chart keeps its own path;
revisit when a second profile needs the same commands.
