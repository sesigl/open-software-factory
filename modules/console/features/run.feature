@module=console @owner=maintainers
Feature: The run page
  The page "/runs/<runId>" shows one run: its origin, its stages as its evidence, and links to its trace, transcripts
  and history (ADR 0072).

  @id=SCN-CONSOLE-015 @status=planned @realizes=SCN-FACTORY-VIS-002
  Scenario: The run page shows the stages with their agent and state
    Given a foreman with the run "Add diagnostics to cloud agent runs" whose stage "plan" succeeded and whose stage "implement" runs
    When a person opens the run's page
    Then the page shows the stage "plan" of the agent "planner" as "succeeded"
    And the page shows the stage "implement" of the agent "developer" as "running"
    And the page shows the factory version "0a1b2c3"

  @id=SCN-CONSOLE-016 @status=planned @realizes=SCN-FACTORY-VIS-002
  Scenario: The run page links its Slack origin and its pull request
    Given a foreman with a run that "Ben" asked for in the Slack thread "https://acme.slack.com/archives/C0WORK/p1767225600000001" and whose pull request is "https://github.com/acme/web/pull/7"
    When a person opens the run's page
    Then the page links the origin "https://acme.slack.com/archives/C0WORK/p1767225600000001" as "slack"
    And the page names the requester "Ben"
    And the page links the pull request "https://github.com/acme/web/pull/7"

  @id=SCN-CONSOLE-017 @status=planned @realizes=SCN-FACTORY-VIS-002
  Scenario: With intake, the run page lists every request of the work item
    Given a foreman with a run from Slack, and intake whose work item has a second request from "github" by "Varun" at "https://github.com/acme/web/issues/12"
    When a person opens the run's page with "CONSOLE_INTAKE_URL" set to intake
    Then the page lists the requests from "slack" and "github"
    And the page links the origin "https://github.com/acme/web/issues/12" asked by "Varun"

  @id=SCN-CONSOLE-018 @status=planned @realizes=SCN-FACTORY-VIS-002
  Scenario: The run page links its trace and each stage's transcript
    Given a foreman with a run whose stage "plan" has the session "sess-plan"
    When a person opens the run's page with "CONSOLE_TRACE_URL" set to "https://langfuse.acme.dev/traces?run={runId}" and "CONSOLE_SESSION_URL" set to "https://langfuse.acme.dev/sessions/{sessionId}"
    Then the page links the trace "https://langfuse.acme.dev/traces?run=run_5d41402abc4b2a76b971"
    And the page links the transcript "https://langfuse.acme.dev/sessions/sess-plan" of the stage "plan"

  @id=SCN-CONSOLE-019 @status=planned
  Scenario: The run page links its history in the Temporal UI
    Given a foreman with the run "run_5d41402abc4b2a76b971"
    When a person opens the run's page with "CONSOLE_TEMPORAL_URL" set to "https://temporal.acme.dev"
    Then the page links the history "https://temporal.acme.dev/namespaces/default/workflows/run_5d41402abc4b2a76b971"

  @id=SCN-CONSOLE-020 @status=planned
  Scenario: The run page shows a stage's gate with its state and who it waits for
    Given a foreman with a run whose stage "ship" waits at the gate "g0123456789abcdef", and gatekeeper whose gate is "pending" for "leads"
    When a person opens the run's page with "CONSOLE_GATEKEEPER_URL" set to gatekeeper
    Then the page shows the gate "g0123456789abcdef" of the stage "ship" as "pending", waiting for "leads"

  @id=SCN-CONSOLE-021 @status=planned
  Scenario: The run page shows the checks a stage waits for and why a stage failed
    Given a foreman with a run whose stage "ship" failed with the reason "the check ci failed" and the check "ci" in the state "failure"
    When a person opens the run's page
    Then the page shows the check "ci" as "failure"
    And the page shows the reason "the check ci failed"

  @id=SCN-CONSOLE-022 @status=planned
  Scenario: A run that no foreman knows answers 404
    Given a foreman that answers 404 for the run "run_00000000000000000000"
    When a person opens "/runs/run_00000000000000000000"
    Then the page answers 404 and says "no run run_00000000000000000000"
