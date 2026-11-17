---
status: accepted
topic: process
date: 2026-11-17
---

# 0161. An index of the decisions that last, and status lines that change

## Context

`docs/decisions/` holds about 160 records. A reader who wants to understand the product and its architecture has to
open them one by one, and cannot tell which still hold. Many records are about the mechanics of tests and CI: how a
suite replays its cache, how mutation cuts shards, how long a budget is. They matter to the people who change CI, not
to a reader of the product.

ADR 0001 says that a record is not edited after acceptance; a new record supersedes an old one. In practice records
already carry notes in their status line, such as `accepted; build tool part superseded by 0010`, and the ADR check
accepts them. But some records that later ones changed say nothing: ADR 0003 still names SQLite and a query layer for
two dialects, and ADR 0016 still starts every service per scenario. The audit of November 2026 asked for an index
and for these notes (`TODO.md` T-91).

## Decision

- **A status line may change.** The body of an accepted record stays as it was. Its `status:` line may change when a
  later record supersedes or amends it: `superseded by NNNN`, or `accepted;` with a short note that names the later
  record, such as `accepted; amended by 0157 (shared starts)`. The later record makes the change in the same pull
  request. This amends ADR 0001.
- **Every record names its topic.** The front matter has a line `topic:` with one of: `process`, `stack`, `packages`,
  `testing`, `ports`, `tools`, `factory`, `runs`, `console`, `install`, or `design-note`. A topic may change like the
  status line. The ADR check fails a record without a topic or with another value.
- **Design notes are the records of test and CI mechanics.** Their topic is `design-note`. They stay records with the
  same rules; the index lists them apart, after the decisions that last.
- **The index is generated.** `make docs` writes `docs/decisions/README.md` below its marker: one group per topic, one
  line per record with its number, title and status note, then the design notes, then the records that are superseded,
  rejected or deprecated. DOCS-GEN keeps it current, so a new record or a changed status line shows up in the next
  `make docs`.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A `topic:` field and a generated index (chosen) | One line per record; the ADR check and DOCS-GEN keep it current | A new topic needs a change of the check |
| A hand-kept index | No code | Goes stale with the next record; no check can tell a missing line |
| A field `kind: design-note` beside a hand-kept grouping | Marks design notes only | Two places for one fact; the grouping still goes stale |
| Move the design notes to `docs/design/` | Separate folders | Breaks every link to them; they are still decisions with the same numbers |
| Keep ADR 0001 as it is and write a new record per correction | No edit of old files | A reader of the old record still does not learn that it changed |

## Prior art

- Michael Nygard's ADR format and adr-tools (MIT) keep a status that changes to "Superseded by" in
  the old record; `adr generate toc` writes a table of contents. The same method, here from our own front matter.
- log4brains (Apache-2.0) builds a site from ADRs with a status in each record's header.
  Not adopted: a site and a dependency for one list that `make docs` already can write.
- MADR (MIT, active) puts `status:` in YAML front matter, as this repository does.

## Consequences

- `docs/decisions/README.md` lists the records that last, grouped by topic, and the design notes apart.
- A new record needs a `topic:` line; `_template.md` and `skills/write-adr` say so.
- ADRs 0003, 0016, 0049 and 0093 name what changed them. A later record that changes an older one updates its status
  line in the same pull request.
- Revisit the topics when one group grows past about 30 records.
