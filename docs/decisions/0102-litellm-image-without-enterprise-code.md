---
status: accepted
date: 2026-11-10
---

# 0102. The LiteLLM image holds no code under BerriAI's enterprise license

## Context

ADR 0098 publishes `ghcr.io/sesigl/open-software-factory/litellm`, BerriAI's LiteLLM image with its Python bytecode
compiled. LiteLLM's core has the MIT license. BerriAI's image also holds its enterprise code, in `/app/enterprise` and
in the package `litellm_enterprise`, under the BerriAI Enterprise license. That license allows production use only
with a BerriAI subscription, and allows changed copies of that code to be used and distributed only with an
enterprise license. It allows copies and changes for development and testing. Our image compiled that code too, so it
was a changed copy that this project published.

The profile and the chart use no enterprise feature: the gateway routes models and makes keys with budgets for each
run (ADR 0056, ADR 0070), which the MIT core does.

## Decision

- The target `litellm` of `deploy/images/Dockerfile` removes `/app/enterprise` and `litellm_enterprise` before it
  compiles the bytecode. The image takes the tag `1.106.2-r1`; the chart takes the version 0.1.9.
- `SCN-DIST-027` fails when the profile's LiteLLM image holds enterprise code, for example after a new LiteLLM version.
- The tag `1.106.2`, which holds the enterprise code, stays on GHCR until the maintainer decides to remove it.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Our image without the enterprise code | Only MIT code of LiteLLM; the faster start of ADR 0098 stays | A step to keep with each LiteLLM version, which `SCN-DIST-027` checks |
| BerriAI's image as it is | We distribute nothing | The slower start of ADR 0098 comes back |
| Our image with the enterprise code | Nothing to change | We distribute a changed copy of code whose license does not allow it |

## Prior art

No new dependency. BerriAI publishes `litellm`, `litellm-database` and `litellm-non_root`; each holds the enterprise
code, and none is published without it. LiteLLM imports `litellm_enterprise` only when it is there.

## Consequences

The published image holds LiteLLM's MIT code and its dependencies only. A gateway of the profile or the chart has no
enterprise feature, as before, since none had a BerriAI license. A new LiteLLM version moves the stage's `FROM`, the
tag in `compose.yaml` and `values.yaml`, and must keep `SCN-DIST-027` green.
