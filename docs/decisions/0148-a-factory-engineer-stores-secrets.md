---
status: accepted
date: 2026-11-15
---

# 0148. A factory engineer stores secrets; only an admin deletes one

## Context

ADR 0134 gave the console three roles, and T-56 of `TODO.md` let only an `admin` store and delete secrets (ADR 0137).
The vision scenario SCN-FACTORY-RUNTIME-010 says a person with the role `factory-engineer` stores the value of a
secret in the factory UI. A factory engineer already changes the factory from the UI (ADR 0144): they add a secret
reference to an agent, and then had to ask an admin for its value. The owner decided on 15 November 2026 that a factory
engineer also stores secrets.

## Decision

- **An admin and a factory engineer open `/secrets`, store a value and replace it.** The navigation links "Secrets"
  for both, and the skills pages give both the link "Store a value" beside a missing secret. A member gets 403, as
  before.
- **Only an admin deletes a secret.** A delete removes every version of a value from the store, and the next run of an
  agent that declares it fails before its first turn. Replacing a value keeps the versions before it in OpenBao. So
  the page offers "Delete" only to an admin, and the page and the form of a delete answer 403 to anyone else.
- The roles in short:

  | Role | May |
  | --- | --- |
  | `member` | See every page but Secrets; submit work; act on runs and gates |
  | `factory-engineer` | The same, change the factory from the UI, and store and replace secrets |
  | `admin` | The same, and delete secrets |

- Nobody reads a value, as before: the console's token in OpenBao cannot read one (ADR 0137), whoever presses the
  button.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A factory engineer stores and replaces, an admin deletes (chosen) | The person who adds a secret to an agent can give it its value; the one action that breaks runs at once stays with the admin | Two rules on one page |
| A factory engineer may do all an admin does on `/secrets` | One rule | A delete is final for every version and breaks the next run; the owner asked only for storing |
| Only an admin, as before | Fewest people with write access to the store | The vision scenario says otherwise; a factory engineer waits for an admin for every new secret |

## Prior art

No new module, dependency or service. Roles that may write a secret but not delete it are common in secret stores:
OpenBao's own policies separate `create`/`update` from `delete`, and the console's token holds both because the console
checks the person's role first.

## Consequences

- SCN-CONSOLE-230 to 233 replace SCN-CONSOLE-177 to 179, whose texts named only the admin. SCN-CONSOLE-231 and
  SCN-E2E-007 realize SCN-FACTORY-RUNTIME-010.
- Whoever may write to the factory's repository can still make themselves `admin` (ADR 0134); this changes nothing
  there.
- Revisit when an owner wants the store's write access narrower again, or a role that only reads which secrets exist.
