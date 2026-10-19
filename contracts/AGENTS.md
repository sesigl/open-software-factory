# AGENTS.md for `contracts`

Adds rules for the contracts. The root `AGENTS.md` applies in full. `contracts/` is a protected path: change it only
with a person's approval.

## Public surface

The only ways a system test or another program may use the contracts:

- CLI: `osf-contracts <command>` (see `README.md#commands`)
- Library: `@osf/contracts` (`validate`, `isValid`, `schemaOf`, `breakingChanges`, the format types)
- Files: `<format>/<format>.schema.json`, `events/asyncapi.yaml`, `openapi/openapi.json`

`typespec/` is the source; `scripts/` and `src/` are private. Generated files are never edited by hand.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 60 seconds in total on the CI runner.

## Scenario prefix

`SCN-CTR-NNN`
