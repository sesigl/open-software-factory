---
name: write-adr
description: Record a durable decision, including every new module, dependency, service or contract change. Use before the change, not after.
---

# Write an ADR

1. Copy `docs/decisions/_template.md` to `docs/decisions/NNNN-<short-name>.md` with the next number.
2. Fill in: context, decision, options considered, consequences.
3. Fill in **Prior art** for every new module, dependency or service: which existing projects you checked,
   their license and maintenance state, and why you adopt, extend or build. The DOCS check rejects an empty
   Prior art section.
4. Set `status: proposed`. A person sets `accepted`.
5. Link the ADR from the module README and the pull request.
