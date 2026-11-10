---
status: accepted
date: 2026-11-10
---

# 0098. A LiteLLM image with its bytecode compiled

## Context

The Compose profile and the Helm chart run LiteLLM as their LLM gateway, from the image `ghcr.io/berriai/litellm`.
In each start of the profile or the chart, LiteLLM is the last service to be ready, so its start is the critical path
of `docker compose up --wait` and of `helm install --wait`. The deploy suite starts LiteLLM about 9 times and the e2e
suite 6 times, and the deploy suite is near its time budget of 600 s: 567 s on `main`, and up to 722 s on slower
runners.

Measured on a developer's machine, one start of LiteLLM 1.106.2 on an empty database takes about 12.7 s. Of that,
about 12 s pass before its first log line, 2.2 s go to its 213 Prisma migrations, and 1.3 s to its application
start. The image has no Python bytecode for LiteLLM: 0 `.pyc` files for 2776 `.py` files. So each new container
compiles every module again when it starts. BerriAI's other images, `litellm-database` and `litellm-non_root`, have
no bytecode either.

## Decision

- The target `litellm` of `deploy/images/Dockerfile` is `FROM ghcr.io/berriai/litellm:<version>` with
  `python -m compileall` on its packages, and nothing else.
- The profile and the chart run it as `ghcr.io/sesigl/open-software-factory/litellm:<version>`. `publish-images`
  publishes it with the module images, signed, as for every image of `compose.yaml` that the profile builds.
- PROFILE accepts a chart image that the profile builds, and its rule for Dockerfile stages makes a change of the
  stage, like a new LiteLLM version, give the image a new tag.
- The e2e suite pulls or builds the image before its scenarios start, so no scenario spends its time budget on the
  build.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Own image with bytecode | About 37% faster start of LiteLLM alone (12.7 s to 8.0 s), for every user and every scenario | One more image to publish and to move with each LiteLLM release |
| Upstream image | Nothing to publish | Each start compiles LiteLLM again |
| A shared bytecode cache (`PYTHONPYCACHEPREFIX` on a volume) | No own image | Works only when containers share a volume; a new installation and each scenario still compile |
| Fewer LiteLLM starts in the tests | Saves the whole start | Each scenario starts the profile or the chart of its own, so that scenarios stay independent |

## Prior art

No new dependency. LiteLLM (MIT, BerriAI, released weekly) is the gateway of ADR 0056 and ADR 0070. BerriAI publishes
`litellm`, `litellm-database` and `litellm-non_root`; none has bytecode, so the image extends the one that the
profile already uses.

## Consequences

LiteLLM is ready sooner in the profile, the chart and the tests: on a developer's machine, a scenario that starts
the chart or the profile took 2 to 4 s less. The image is 65 MB larger than the upstream one. A new LiteLLM version
changes the stage's `FROM` and the tag in `compose.yaml` and `values.yaml` together; PROFILE fails when one of them is
missing. The inference-litellm adapter still starts the upstream image in its own tests. Revisit when BerriAI ships
bytecode in its images.
