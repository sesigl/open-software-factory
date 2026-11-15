---
status: accepted
date: 2026-11-15
---

# 0143. The JSON of `factory skills` is the format `skill-catalog` of `contracts/`

## Context

`factory skills` of factory-spec prints every skill of a factory as one JSON document, and the console reads it for
`/skills` and `/skills/<name>` (ADR 0141). ADR 0141 left the shape in the prose of factory-spec's README and chose
no contract "for one command and one reader". But the first rule of `AGENTS.md` is that modules share data only
through the formats in `contracts/`. The console's types and the stand-in program of its tests copied the shape by
hand, so factory-spec could rename a field and every test of both modules would still pass.

## Decision

- **A format `skill-catalog`** in `contracts/typespec/skill-catalog.tsp`, schema
  `contracts/skill-catalog/skill-catalog.schema.json`, model `SkillCatalog`: `{ "skills": CatalogSkill[] }`, each skill
  with `name`, `description` (or `null`), `source.folder`, `needs` (`SkillNeeds`: `secrets` as sandbox variables,
  `hosts` as egress entries), `agents` (`CatalogSkillAgent`: `name`, `secrets` by variable to a secret reference,
  `lacks` as `SkillNeeds`), `files`, `body` (or `null`) and `problems`. It is exactly the JSON that ADR 0141 defined:
  no field is renamed or added.
- **It is a wire format, so it is open**: a reader ignores a field it does not know, and a minor version of
  `contracts` may add an optional one. Every field the command prints today is required, so a field that is renamed or
  dropped fails `validate`. It has no `version` field: it is the output of a command, read at once, like the views of
  the HTTP APIs, not a file that is kept.
- **factory-spec writes it**: its type `CatalogSkill` is the contract's, and SCN-FSPEC-118 checks the printed JSON
  with `validate("skill-catalog", …)`.
- **The console reads it** through the contract's types, and its tests check the stand-in program's JSON with the
  same `validate` before they start the console, so a drift on either side fails a test. The console does not
  validate the JSON at run time: what the pages show does not change.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A format of `contracts/` (chosen) | One schema for writer and reader; CONTRACT guards it; the rule of `AGENTS.md` holds | One more format to keep |
| Keep the README's prose (ADR 0141) | Nothing to build | The two copies drift without a check |
| A closed format (unknown fields are errors) | Also catches a field the stand-in adds | A console with older contracts would refuse a newer factory-spec's added field |
| A `version` field, as `factory.lock` and `access.yaml` have | Room for a second major form | Changes the output; a command's output is read at once, and a breaking change gets a new major of `contracts` |

## Prior art

No new dependency or service: the format uses TypeSpec and Ajv as every other format does (ADR 0006, ADR 0012).

## Consequences

- A change to the JSON of `factory skills` is a change to `contracts/`, and CONTRACT fails a breaking one without a
  major version.
- Skills of other repositories (pins in `factory.lock`, ADR 0141) add an optional field to `source`.
- ADR 0141's option "the JSON as a format of `contracts/`" is now taken; this decision replaces its "documented in a
  README" for the shape.
