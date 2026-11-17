---
status: accepted
topic: testing
date: 2026-11-17
---

# 0166. Test hooks need a switch

## Context

System tests have no real clock and no randomness (`docs/principles.md`). The testkit gives every module process a
fixed clock as `OSF_NOW` and a seed as `OSF_SEED`, and the modules read them instead of the clock and chance:
gatekeeper for the escalation and expiry of gates and the time of a person proof, foreman and intake for the times of
runs and work items and of person proofs, console for the age of a run, its sign-in and the waits of
`console doctor --deep`, channel-slack for the age of a signed request, and proof, runlog and scorekit for the times
they write. A process in production honored them as well, and each module's configuration table listed them next to
the real settings. An operator, or anyone who can change the environment of a container, who sets `OSF_NOW` freezes
the clock of gatekeeper's approvals and person proofs, lets channel-slack accept a signed Slack request again long
after Slack sent it, and skips the waits of the doctor. The audit of November 2026 found this (`TODO.md` T-93).

The inventory of every variable the modules read found two such test hooks, `OSF_NOW` and `OSF_SEED`. The intervals
that the tests shorten (`FOREMAN_POLL_MS`, `FOREMAN_CHECK_POLL_MS`, `FOREMAN_CHECK_TIMEOUT_MS`,
`FOREMAN_GATE_TIMEOUT_MS`, `FOREMAN_INFERENCE_RETRY_MS`, `FOREMAN_HEARTBEAT_TIMEOUT_MS`, `GATEKEEPER_POLL_MS`) are
settings an operator tunes as well; they stay settings.

## Decision

- A test hook is a variable that only the system tests set. Today: `OSF_NOW` and `OSF_SEED`. A module reads one only
  through `testHook(env, name)` of `@opensoftware/cli`, at the start of its command, before it reads or starts
  anything else.
- `testHook` gives the hook's value only when `OSF_TEST_HOOKS` is `1`. With the hook set and without the switch it
  throws a usage error, `<name> is a test hook, which works only with OSF_TEST_HOOKS=1 in the system tests: unset
  <name>`, so the command exits 2. An unset or empty hook gives no value and no error.
- The testkit sets `OSF_TEST_HOOKS=1` in the one place where it builds the environment of every module process
  (`makeLaunch`), next to `OSF_NOW` and `OSF_SEED`. A module that starts an adapter passes its environment on, so the
  adapter gets the switch too. The end-to-end suite sets the switch next to its fixed clock in
  `e2e/compose/override.yaml`; the Compose profile and the Helm chart never set it (SCN-DIST-072).
- A module's `config.schema.json` marks a test hook with `"x-test-hook": true`. `make docs` lists the hooks under
  `### Test hooks` in the Configuration section, after the settings, with `OSF_TEST_HOOKS` and the sentence that
  only the tests set them.
- An interval that tests shorten stays a setting when an operator may tune it, and its value is checked at the start:
  `GATEKEEPER_POLL_MS`, which took `0`, `-5` and `1s` without a word, now needs a whole number of 1 or more, as the
  numbers of foreman do (SCN-FORE-192).

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Refuse a hook without the switch, exit 2 (chosen) | An operator who set `OSF_NOW` sees it at once and by name; nothing runs on a frozen clock. | A deployment that set `OSF_NOW` stops at its start until the variable goes; none of ours does. |
| Ignore a hook without the switch | Nothing that starts today stops. | The operator does not learn that the variable has no effect; a typo in the switch makes a test run on the real clock with no clear failure. |
| Remove the hooks, inject a clock in the tests another way (faketime, a preload) | No hook in the product at all. | `libfaketime` changes every process and the child processes the tests rely on, a preload changes how the testkit starts each module; much more than a switch for the same protection. |
| A switch per hook | Finer control. | Two names where one does; the testkit sets them all anyway. |

## Prior art

No new dependency. Spring Boot and Rails tie test-only behavior to an explicit profile or environment
(`spring.profiles.active=test`, `RAILS_ENV=test`) rather than to the presence of the value itself; Go's
`testing.Testing()` lets code ask whether it runs in a test. The switch follows the same idea with one variable.

## Consequences

- A production process can no longer be put on a fixed clock or a known seed through its environment.
- A scenario that shows the refusal sets `OSF_TEST_HOOKS` to `""` in `env`; the variable is documented with the hooks,
  so BOUNDARY-ENV allows it.
- A new test hook is marked `"x-test-hook"` in its module's schema and read with `testHook`.
- Gatekeeper, foreman and console each have a scenario of their own for the refusal (SCN-GATE-118, SCN-FORE-197,
  SCN-CONSOLE-282); the behavior of `testHook` itself is SCN-CLI-021 to SCN-CLI-023, which intake, proof, runlog,
  scorekit and channel-slack rely on.
