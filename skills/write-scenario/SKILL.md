---
name: write-scenario
description: Write or change a Gherkin scenario for a module. Use before any behavior change, when a ticket describes new behavior, or when a scenario is missing for existing behavior.
---

# Write a scenario

A scenario describes one observable behavior of one module, seen from outside the module.

## Steps

1. Open `modules/<name>/features/`. Search for an existing scenario that already covers the behavior:
   `grep -rn "<key words>" modules/<name>/features`. Extend it only if it is still `planned`.
2. Get a new ID: `make next-id MODULE=<name>`. Never reuse or renumber an ID.
3. Write the scenario with these tags, in this order:

   ```gherkin
   @id=SCN-PROOF-004 @status=planned
   Scenario: The evidence bundle is attached to the pull request
     Given a pull request with a Playwright trace
     When the developer runs "proof attach" for the pull request
     Then the pull request has a comment that links the evidence bundle
     And the pull request has a check named "proof" with the result "success"
   ```

4. Run `make check`. The SPEC check must pass.

## Rules

- One behavior per scenario. Split a scenario with two `When` steps.
- Steps describe what a user or a calling program does and sees: CLI input and output, API calls and
  responses, events, files, messages in a fake chat or forge. Never internal state, classes or tables.
- Use concrete values (`"proof attach"`, `"success"`), not words like "valid" or "correct".
- Use the glossary terms in `docs/reference/glossary.md`.
- Step text is a contract: the system test repeats it word for word.
- A `Then` states the fact a user relies on: `Then the error names the missing field "token"`, not the whole
  message in quotes. Quote the whole text only when the exact text is the contract (a line other programs parse,
  a format, a published name).
- New scenarios start as `@status=planned`. Only `implement-scenario` sets `implemented`, after the test passes.
- Editing an `implemented` scenario (ADR 0157):
  - The behavior stays the same (a reworded message, a renamed label, a longer list of the same kind, a constant
    that is not the point of the scenario): edit the text in place and change the test's labels in the same commit.
  - The behavior changes or goes away: write a new scenario with `@replaces=SCN-...`, mark the old one `deprecated`
    and delete its test in the same change.
  - Never edit a scenario to make a failing test pass. The review reads the "steps changed" rows of the spec-trace
    summary.

## Scenario Outlines

Use an Outline when several scenarios have the same steps and only their literals differ, such as "one invalid
input, one message". It has one ID and one system test; each case is a row of `Examples`. When a case needs a
step of its own, it is a scenario of its own.

```gherkin
@id=SCN-FSPEC-090 @status=planned
Scenario Outline: lint names the field that is missing
  Given a factory file without the field "<field>"
  When the developer runs "factory lint"
  Then the command exits with code 1
  And the error names the missing field "<field>"

  Examples:
    | field  |
    | name   |
    | stages |
```

Its test is one `scenario()` call that runs once for each row (see `skills/write-system-test`). When the old
scenarios of a family become one Outline, mark each `deprecated`, delete its test, keep each case as a row and give
the Outline one `@replaces=` tag for each of them.

## A shared start

Scenarios that only read a system whose start takes more than about 10 seconds (the Compose profile, an installed
Helm chart, a LiteLLM gateway) may share one start of it (ADR 0157). Tag each scenario of the group with the same
`@shared=<name>`, for example `@shared=compose-profile`, after `@id` and `@status`. Each keeps its own steps and its
own test. A scenario in the group does not change the shared system, or changes it only under a name of its own (a
project, a namespace, a key). A shared start is allowed only outside REACH and MUTATION, today in `deploy/` and
`e2e/`.
- A port's shared behavior goes into `ports/<port>/features/` with `@conformance`. Every adapter of the port
  runs those scenarios.
