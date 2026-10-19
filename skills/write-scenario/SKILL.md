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
- New scenarios start as `@status=planned`. Only `implement-scenario` sets `implemented`, after the test passes.
- Never edit the steps of an `implemented` scenario. To replace behavior, write a new scenario with
  `@replaces=SCN-...`, mark the old one `deprecated` and delete its test in the same change.
- A port's shared behavior goes into `ports/<port>/features/` with `@conformance`. Every adapter of the port
  runs those scenarios.
