---
status: accepted
date: 2026-11-10
---

# 0100. A Phoenix image with its bytecode compiled, and foreman does not wait for Phoenix

## Context

The Compose profile runs Phoenix as its trace store, from the image `arizephoenix/phoenix`. After ADR 0098 and ADR
0099, Phoenix was the last service of the profile to be ready, and foreman waited until Phoenix was healthy before it
started. So Phoenix's start, then foreman's start, then the console's start, were the critical path of
`docker compose up --wait`. The deploy suite starts the profile 5 times and the e2e suite 6 times, and the deploy suite
is at its time budget of 600 s on CI.

Measured on a developer's machine, Phoenix 20.26.1 takes about 13.4 s from its start until `/healthz` answers. Its
image has no Python bytecode: 0 `.pyc` files for 15884 `.py` files, so each new container compiles them again.

foreman needs Phoenix only to send spans: it sends a span when a stage or a run ends, and a span that it cannot send is
a warning, never a failed stage (ADR 0087).

## Decision

- The target `phoenix` of `deploy/images/Dockerfile` is `FROM arizephoenix/phoenix:version-<version>` with
  `python -m compileall` on its packages, and nothing else. The profile runs it as
  `ghcr.io/sesigl/open-software-factory/phoenix:<version>`, which `publish-images` publishes as it does every image
  that the profile builds (ADR 0098).
- In the profile, foreman waits until Phoenix has started, not until it is healthy. `docker compose up --wait` still
  waits until Phoenix is healthy.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Own image with bytecode, foreman waits until Phoenix started | Phoenix alone starts in 6.6 s instead of 13.4 s; foreman, Phoenix and LiteLLM start side by side | One more image to publish and to move with each Phoenix release |
| Only foreman does not wait for Phoenix | Nothing to publish | Phoenix is still the slowest service, so `up --wait` waits for it |
| Upstream image as it is | Nothing to change | Phoenix stays the critical path of each start of the profile |

## Prior art

No new dependency. Phoenix (Elastic License 2.0, Arize AI, released weekly) is the trace store of ADR 0074 and ADR
0087. Arize publishes `arizephoenix/phoenix` with no bytecode; the image extends the one that the profile already uses,
as ADR 0098 does for LiteLLM.

The published image is a copy of Phoenix with compiled files added. The Elastic License 2.0 allows copies,
distribution and derived works, when the license terms and the notices go with them, and forbids offering Phoenix as
a hosted or managed service. The image keeps Phoenix's `LICENSE` and `IP_NOTICE` files unchanged, and its label
`org.opencontainers.image.licenses` is `Elastic-2.0`.

## Consequences

The profile is ready sooner: on a developer's machine, SCN-DIST-003 took about 5 s less with this decision and with
the testkit's faster stop of a profile. LiteLLM is now the critical path, because foreman is healthy only once it is
attached to LiteLLM (ADR 0099). The image is about 280 MB larger than the upstream one. A span of a stage that ends in
the first seconds after a start, before Phoenix is ready, is lost with a warning in foreman's log. A new Phoenix
version changes the stage's `FROM` and the tag in `compose.yaml` together. Revisit when Arize ships bytecode in its
image.
