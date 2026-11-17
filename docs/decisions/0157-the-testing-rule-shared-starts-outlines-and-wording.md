---
status: accepted
topic: testing
date: 2026-11-16
---

# 0157. The testing rule: shared starts, Outlines and wording in place

## Context

ADR 0007 made the rule: every behavior is a Gherkin scenario, and every implemented scenario has exactly one system
test that drives the built module from outside. `AGENTS.md` added that the text of an `implemented` scenario never
changes: a change is a new scenario with `@replaces=`, and the old one becomes `deprecated`. ADR 0074 gave each
scenario of the Compose profile a Compose project of its own, and ADR 0075 gave each scenario of the Helm chart a
namespace and a release of its own.

The audit of 16 November 2026 counted:

- 1,997 scenarios, and none of them is a Scenario Outline.
- 53 scenarios of 2,056 take 40 % of the summed test time. Each of them starts a whole stack: the Compose profile,
  the Helm chart on kind, or a LiteLLM gateway with its PostgreSQL. Most of them only read what the stack shows.
- About a third of the scenarios say "one invalid input or one missing setting gives this exact message". They have
  the same steps and differ only in their literals.
- 29 of 42 `@replaces` pairs changed only a message, a constant or a list, not a behavior. Each pair is a new ID, a
  deprecated scenario and a deleted test for a change of wording.

The testkit already shares outside systems that are slow to start: one Forgejo, one PostgreSQL and one Temporal per
test process, with a part for each scenario that no other scenario sees (ADR 0064, ADR 0129). It never shares the
system under test.

## Decision

The rule stays: one scenario, one system test, from outside the built module. Three additions and one writing rule
change how it is applied.

### 1. A shared start

- Scenarios that only **read** a system whose start takes more than about 10 seconds (the Compose profile, an
  installed Helm chart, a LiteLLM gateway) may share one start of it.
- Each of them keeps its own `scenario()` call, its own `given`, `when` and `then` steps and its own result. TRACE,
  STEPS and PASS see them as before.
- Each scenario of a group carries the tag `@shared=<name>`, the same name for the whole group, for example
  `@shared=compose-profile`. A reader sees the group in the feature file, and a search for the tag finds all of it.
  SPEC already accepts the tag: it checks `@id`, `@status` and `@kind` and lets other tags pass.
- A scenario in a group does not change the shared system, or changes it only under a name of its own: a project, a
  namespace, a key, a repository. A scenario that changes the system for everyone (stops a service, changes the
  configuration, fills a disk) has a start of its own.
- When the shared start fails, every scenario of the group fails, each with its own result.
- This extends the rule of ADR 0064 and ADR 0129 from the outside systems to the system under test itself. The start
  runs once per test process, like those fakes.
- REACH and MUTATION: a process that scenarios share belongs to no single scenario, so its coverage and its mutants
  belong to none. Today the deploy suite (`deploy/`) and the smoke scenarios (`e2e/`) are outside REACH and MUTATION,
  and code in a container is never covered. So a shared start is allowed there. Inside a module, adapter or library
  that REACH or MUTATION covers, a shared start is not allowed yet: T-83 decides for inference-litellm whether the
  shared part can be the containers alone, which hold none of the adapter's code.
- The testkit's API for it, a shared form of `sut.compose` and `sut.helm`, comes with T-82, and so does any check
  that a `@shared` scenario uses it.

### 2. Scenario Outlines

- A family of "one input, one message" is one Scenario Outline: one scenario ID, one system test, and the cases as
  rows of its `Examples` table.
- Use an Outline when the scenarios have the same steps and only their literals differ. When a case needs a step of
  its own, it is a scenario of its own.
- STEPS already matches a parameter `<name>` with any value, and PASS fails the Outline when one of its examples
  failed. The testkit's examples form of `scenario()` comes with T-84.

### 3. Wording may change in place

- The text of an `implemented` scenario may be edited when the behavior it states stays the same: a reworded
  message, a renamed label, a longer list of the same kind, a changed constant that is not the point of the scenario.
  The test's labels change with it in the same commit, and STEPS still compares them.
- `@replaces=` with a deprecated old scenario stays for behavior that changes or goes away.
- The guard against "edit the requirement until the test passes" is the review. The job summary of `verify.yml` has
  the report of spec-trace with every scenario whose steps changed since the base ("steps changed"), next to the ones
  added, removed and with a new status. That is enough to find the edits. Two small gaps stay, for a follow-up item:
  the row does not say that the scenario was already `implemented`, and a change to only the rows of an Outline's
  `Examples` is not listed, because the report compares the steps' text and counts the rows.

### The writing rule for `Then`

A `Then` states the fact a user relies on, for example `Then the error names the missing field "token"`, not the
whole message in quotes. Quote the whole text only when the exact text is the contract: a line other programs parse,
a format, a published name.

### What stays

- No unit tests by default (ADR 0007). A module's `AGENTS.md` may allow them for a pure algorithm.
- No test without a scenario, and no scenario with two tests.
- Nothing reaches inside: no import from `src/`, no read of a module's database, cache or private files.
- No real network, model, clock or randomness.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Keep the rule as it is | No change to learn | The 53 whole-stack starts stay 40 % of the test time; a third of the scenarios stay near copies; wording changes keep making new IDs |
| One test for many scenarios, everywhere | Fewest starts | A failure no longer names its scenario; a mutant reruns a larger test; TRACE and PASS lose their meaning |
| Unit tests for input validation | Fast and small | Against ADR 0007; tests import from `src/`; Outlines give most of the gain from outside |
| The three additions (chosen) | The slow starts and the near copies shrink where they are; each scenario keeps its test and result | A group loses isolation; frozen wording is gone as a guard |
| Mark a group with a Gherkin `Rule:` block or a feature-level tag | One line per group | A scenario that moves loses its group without a trace; a tag on the scenario is found by a search and read by spec-trace's parser as it is |

## Prior art

- [Cucumber's Gherkin reference](https://cucumber.io/docs/gherkin/reference/) (MIT, active): "`Scenario Outline` can
  be used to run the same `Scenario` multiple times, with different combinations of values", one run per row of its
  `Examples`. We adopt it as it is; `@cucumber/gherkin` is already the parser of spec-trace. `Background` adds steps
  before each scenario of a feature: it shares text, not a start, so it does not cover this case.
- [Cucumber's API reference](https://cucumber.io/docs/cucumber/api/): global hooks `BeforeAll` and `AfterAll` run once
  for the whole suite, and a `Before` hook can be bound to a tag expression. Our tag `@shared=<name>` names such a
  group in the feature file; we do not run Cucumber, so the start lives in the testkit (T-82).
- [pytest fixtures](https://docs.pytest.org/en/stable/how-to/fixtures.html) (MIT, active): a fixture has a scope,
  `function` by default, up to `module`, `package` and `session`, and the docs advise a wider scope for fixtures that
  are "time-expensive to create". Our shared start is a fixture of the test process, the scope of ADR 0064 and 0129.
- [Testcontainers for Node](https://node.testcontainers.org/features/containers/) (MIT, active), already in the
  testkit: with reuse it "will not start a new container if a Testcontainers managed container with the same
  configuration is already running". Reuse spans test runs, so state leaks from one run into the next; we share only
  inside one test process, which ends with its containers.
- Not opened: the Cucumber-JVM and SpecFlow docs on shared context. The pages above were enough for the decision.

## Consequences

- The deploy suite can start the profile once and install the chart once (T-82), and the families of messages become
  Outlines (T-84). Fewer IDs are deprecated for a change of wording.
- Lost inside a group: isolation. A scenario that changes the shared system by mistake can break a later one, so the
  review checks that a `@shared` scenario only reads or works under a name of its own.
- One failed start fails the whole group.
- Lost as a guard: frozen wording. An edit of an implemented scenario is now allowed, so the review has to read the
  "steps changed" rows of the spec-trace summary.
- Revisit when a shared start is wanted inside a unit that REACH or MUTATION covers, and when the follow-up for the
  spec-trace report is built.
- This ADR amends ADR 0007 and ADR 0074. ADR 0051 and ADR 0129 do not contradict it.
