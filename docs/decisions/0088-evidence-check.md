---
status: accepted
date: 2026-11-08
---

# 0088. A stage with required evidence waits for the check "proof"

## Context

A stage of `factory.yaml` can say `evidence: required` (contracts, `EvidenceRequirement`), and the reference factory
says it for its stage `verify`. The foreman ignored the field: a run shipped a pull request without any evidence, so
principle P10 ("prove the work") held for this repository's CI, not for the factory's runs. The review of the whole
stack marked this as a P1 gap for v1 (`TODO.md` T-26).

proof already writes the evidence of a pull request: `proof attach` (and its GitHub Action) posts the bundle's
scenarios on the pull request and sets the commit status `proof`, `success` when every scenario passed (ADR 0005). The
foreman already reads commit statuses as checks through the forge port (ADR 0069).

## Decision

- **`evidence: required` adds the check `proof`** to the stage's `checks`. The stage starts only when `proof` and its
  own checks succeeded on the run's pull request, waits while one is pending or missing, and fails when one failed,
  as for any check.
- **A forge adapter is required.** A factory with such a stage and no adapter under `providers.forge` stops the server
  at the start with `/workflow/<index>/evidence: name one forge adapter under providers.forge`.
- **`evidence: optional`** and no `evidence` change nothing.
- **The foreman does not read the bundle.** The check is the contract between proof and the foreman; where the
  bundle lives (GitHub artifacts, an S3 store) is proof's choice.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Wait for the check `proof` (chosen) | Reuses the forge port and proof's existing status; no new API | A team must run proof in its CI |
| The foreman runs `proof verify` on a bundle | Checks the bundle itself | The foreman needs the bundle's store and proof's CLI; duplicates CI |
| A field `evidence-check:` with the check's name | Any evidence tool | A setting nobody needs yet; can be added without a break |

## Prior art

- **GitHub required status checks**: the same rule for merges; the foreman applies it to a stage.
- **proof** (this repository, ADR 0005): writes the status `proof`.

## Consequences

- A run of the reference factory with an evidence stage blocks until the pull request has the status `proof`. A team
  adds proof's GitHub Action to its CI, or removes `evidence: required` from the stage.
- The Compose profile's SeaweedFS has no consumer in the loop: proof's bundles in this repository live as GitHub
  artifacts.
