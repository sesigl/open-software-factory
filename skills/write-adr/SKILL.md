---
name: write-adr
description: Record a durable decision, including every new module, package, dependency, service or contract change. Use before the change, not after.
---

# Write an ADR

1. Copy `docs/decisions/_template.md` to `docs/decisions/NNNN-<short-name>.md` with the next number.
2. Fill in: context, decision, options considered, consequences.
3. Fill in **Prior art** for every new module, dependency or service: which existing projects you checked,
   their license and maintenance state, and why you adopt, extend or build. The DOCS check rejects an empty
   Prior art section.
4. Fill in **Why a package** for every new published package (module, adapter or library), and delete the section
   otherwise (ADR 0159). Answer each question; the ADR check rejects a new package without this section, and an
   empty one:
   - Its job in one sentence (ADR 0135).
   - Why it is installed or released alone: a user or another repository installs it without the rest, a factory
     names it as the adapter of a port in `factory.yaml`, or two units of different release cadence need it.
   - For a library: the two units that use it in this pull request. A planned user does not count.
   - Its size. About 300 lines of source is the floor for a library; an adapter may be smaller, then say why it is
     not a command in a package of its port family.
   - Why the code does not fit an existing library (`cli`, `testkit`, `contracts`, `factory-source`, `spec-files`)
     or the one unit that uses it.
5. Set `status: accepted` when the pull request makes the decision; its review is the approval. Use
   `proposed` only for a decision that stays open after the pull request.
6. Link the ADR from the module README and the pull request.
