---
name: keep-docs-evergreen
description: Update documentation in the same change as the code. Use at the end of every change, and when the DOCS check fails.
---

# Keep the docs current

Docs fall into four kinds. Each kind has its own rule.

| Kind | Where | How it stays current |
| --- | --- | --- |
| Reference | CLI help, config keys, API, events, scenario list | Generated from code and contracts by `make docs`. Never edit by hand. |
| Requirements | `modules/*/features/*.feature` | The scenarios themselves. Rendered to the docs site. |
| How-to and tutorial | `modules/*/README.md`, `docs/how-to/` | Hand-written. Front matter `covers:` lists the paths they describe. |
| Explanation | `docs/explanation/`, `docs/decisions/` | Hand-written. An accepted ADR is not edited: a new ADR supersedes or amends it, and only the old one's `status` line names the new one (ADR 0001). |

## Steps

1. Run `make docs`. Commit the generated changes.
2. Run `make docs-affected`. It lists every hand-written doc whose `covers:` paths your change touched.
3. Read each listed doc. Update it, or add `docs-reviewed: <doc path>` to the pull request description when
   nothing had to change.
4. Run `make check`: DOCS-GEN (generated docs are current) and DOCS-LINKS (links resolve) run there.
   DOCS-AFFECTED (every affected doc was updated or marked reviewed) runs in `make verify` and CI, where it reads the
   pull request description (`docs/quality/checks.md`).

## Rules

- Write short, plain sentences. One idea per paragraph.
- Never copy a fact that has a source of truth. Link to the scenario, the contract or the generated reference.
- Every README keeps its quick start working: it is scenario `SCN-<MODULE>-001`.
