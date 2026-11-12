@module=console @owner=maintainers
Feature: The run page
  The page "/runs/<runId>" shows one run: its origin, its stages as its evidence, and links to its trace, transcripts
  and history (ADR 0072).

  @id=SCN-CONSOLE-015 @status=implemented @realizes=SCN-FACTORY-VIS-002
  Scenario: The run page shows the stages with their agent and state
    Given a foreman with the run "Add diagnostics to cloud agent runs" whose stage "plan" succeeded and whose stage "implement" runs
    When a person opens the run's page
    Then the page shows the stage "plan" of the agent "planner" as "succeeded"
    And the page shows the stage "implement" of the agent "developer" as "running"
    And the page shows the factory version "0a1b2c3"

  @id=SCN-CONSOLE-016 @status=implemented @realizes=SCN-FACTORY-VIS-002
  Scenario: The run page links its Slack origin and its pull request
    Given a foreman with a run that "Ben" asked for in the Slack thread "https://acme.slack.com/archives/C0WORK/p1767225600000001" and whose pull request is "https://github.com/acme/web/pull/7"
    When a person opens the run's page
    Then the page links the origin "https://acme.slack.com/archives/C0WORK/p1767225600000001" as "slack"
    And the page names the requester "Ben"
    And the page links the pull request "https://github.com/acme/web/pull/7"

  @id=SCN-CONSOLE-017 @status=implemented @realizes=SCN-FACTORY-VIS-002
  Scenario: With intake, the run page lists every request of the work item
    Given a foreman with a run from Slack, and intake whose work item has a second request from "github" by "Varun" at "https://github.com/acme/web/issues/12"
    When a person opens the run's page with "CONSOLE_INTAKE_URL" set to intake
    Then the page lists the requests from "slack" and "github"
    And the page links the origin "https://github.com/acme/web/issues/12" asked by "Varun"

  @id=SCN-CONSOLE-018 @status=implemented @realizes=SCN-FACTORY-VIS-002
  Scenario: The run page links its trace and each stage's transcript
    Given a foreman with a run whose stage "plan" has the session "sess-plan"
    When a person opens the run's page with "CONSOLE_TRACE_URL" set to "https://langfuse.acme.dev/traces?run={runId}" and "CONSOLE_SESSION_URL" set to "https://langfuse.acme.dev/sessions/{sessionId}"
    Then the page links the trace "https://langfuse.acme.dev/traces?run=run_5d41402abc4b2a76b971"
    And the page links the transcript "https://langfuse.acme.dev/sessions/sess-plan" of the stage "plan"

  @id=SCN-CONSOLE-019 @status=implemented
  Scenario: The run page links its history in the Temporal UI
    Given a foreman with the run "run_5d41402abc4b2a76b971"
    When a person opens the run's page with "CONSOLE_TEMPORAL_URL" set to "https://temporal.acme.dev"
    Then the page links the history "https://temporal.acme.dev/namespaces/default/workflows/run_5d41402abc4b2a76b971"

  @id=SCN-CONSOLE-020 @status=implemented
  Scenario: The run page shows a stage's gate with its state and who it waits for
    Given a foreman with a run whose stage "ship" waits at the gate "g0123456789abcdef", and gatekeeper whose gate is "pending" for "leads"
    When a person opens the run's page with "CONSOLE_GATEKEEPER_URL" set to gatekeeper
    Then the page shows the gate "g0123456789abcdef" of the stage "ship" as "pending", waiting for "leads"

  @id=SCN-CONSOLE-021 @status=implemented
  Scenario: The run page shows the checks a stage waits for and why a stage failed
    Given a foreman with a run whose stage "ship" failed with the reason "the check ci failed" and the check "ci" in the state "failure"
    When a person opens the run's page
    Then the page shows the check "ci" as "failure"
    And the page shows the reason "the check ci failed"

  @id=SCN-CONSOLE-022 @status=implemented
  Scenario: A run that no foreman knows answers 404
    Given a foreman that answers 404 for the run "run_00000000000000000000"
    When a person opens "/runs/run_00000000000000000000"
    Then the page answers 404 and says "no run run_00000000000000000000"

  @id=SCN-CONSOLE-029 @status=implemented
  Scenario: An origin link that is not http or https is shown as text
    Given a foreman with a run whose origin is "javascript:alert(1)"
    When a person opens the run's page
    Then the page shows "slack asked by Varun" without a link to "javascript:alert(1)"

  @id=SCN-CONSOLE-041 @status=implemented @realizes=SCN-FACTORY-VIS-002
  Scenario: The run page links the run's trace by its trace ID
    Given a foreman with a run whose trace ID is "0af7651916cd43dd8448eb211c80319c"
    When a person opens the run's page with "CONSOLE_TRACE_URL" set to "http://127.0.0.1:6006/projects/UHJvamVjdDox/traces/{traceId}"
    Then the page links the trace "http://127.0.0.1:6006/projects/UHJvamVjdDox/traces/0af7651916cd43dd8448eb211c80319c"

  @id=SCN-CONSOLE-042 @status=implemented
  Scenario: A trace link with "{traceId}" is left out for a run without a trace ID
    Given a foreman with a run without a trace ID
    When a person opens the run's page with "CONSOLE_TRACE_URL" set to "http://127.0.0.1:6006/projects/UHJvamVjdDox/traces/{traceId}"
    Then the page has no link with the text "trace"

  @id=SCN-CONSOLE-050 @status=planned
  Scenario: The run page of a failed run has the form "run again" for a signed-in person
    Given a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and a foreman with a run whose stage "implement" failed
    When the person "ada@acme.dev" opens the run's page
    Then the page has the form "run again"

  @id=SCN-CONSOLE-051 @status=planned
  Scenario: A person runs a failed run again from the run page
    Given a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and a foreman with a failed run "run_5d41402abc4b2a76b971" whose retry starts the run "run_0f3c7e91a2b44d6e8c05"
    When the person "ada@acme.dev" sends the form "run again" of "/runs/run_5d41402abc4b2a76b971"
    Then the answer redirects to "/runs/run_0f3c7e91a2b44d6e8c05"
    And the foreman received a retry of "run_5d41402abc4b2a76b971" by the person "ada@acme.dev"

  @id=SCN-CONSOLE-052 @status=planned
  Scenario: The run page of a run that is running or complete has no form "run again"
    Given a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and a foreman with a running run and a complete run
    When the person "ada@acme.dev" opens the page of each run
    Then neither page has the form "run again"

  @id=SCN-CONSOLE-053 @status=planned
  Scenario: A retry the foreman refuses shows the foreman's problem
    Given a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and a foreman that answers a retry of "run_5d41402abc4b2a76b971" with 409 and "run_5d41402abc4b2a76b971 already ran again as run_0f3c7e91a2b44d6e8c05"
    When the person "ada@acme.dev" sends the form "run again" of "/runs/run_5d41402abc4b2a76b971"
    Then the page answers 409 and says "run_5d41402abc4b2a76b971 already ran again as run_0f3c7e91a2b44d6e8c05"

  @id=SCN-CONSOLE-054 @status=planned
  Scenario: The run page of a run that ran again links the run before it
    Given a foreman with the run "run_0f3c7e91a2b44d6e8c05", the attempt 2 of the run "run_5d41402abc4b2a76b971"
    When a person opens the run's page
    Then the page names the attempt 2 and links the run before "/runs/run_5d41402abc4b2a76b971"
