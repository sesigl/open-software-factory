@module=console @owner=maintainers
Feature: Health
  "console doctor" and the page "/health" check each server of the factory, its token and the factory definition,
  and say what to do for each failure (ADR 0086).

  @id=SCN-CONSOLE-037 @status=implemented
  Scenario: A healthy factory passes every check of "console doctor"
    Given a foreman, an intake and a gatekeeper whose "/v1/health" is ok and that accept their tokens
    And the factory definition with the agent "triage"
    When the user runs "console doctor"
    Then the command exits with code 0
    And it prints "ok" for "foreman temporal", "foreman token", "intake database", "intake token", "gatekeeper opa", "gatekeeper token" and "factory", then "all 7 checks ok"

  @id=SCN-CONSOLE-038 @status=implemented
  Scenario: "console doctor" names each failing check and what to do
    Given a foreman that refuses the console's token
    And an intake whose "/v1/health" answers 503 with the check "nats" failing with "the durable consumer of the run events is not attached: check INTAKE_NATS_URL"
    When the user runs "console doctor"
    Then the command exits with code 1
    And it prints "FAIL  foreman token: foreman refuses the token: set CONSOLE_FOREMAN_TOKEN to its FOREMAN_API_TOKEN"
    And it prints "FAIL  intake nats: the durable consumer of the run events is not attached: check INTAKE_NATS_URL"

  @id=SCN-CONSOLE-039 @status=implemented
  Scenario: A foreman that does not answer is named with the variable of its URL
    Given "CONSOLE_FOREMAN_URL" names a port where nothing listens
    When the user runs "console doctor"
    Then the command exits with code 1
    And it prints "FAIL  foreman: no answer at <URL>: check CONSOLE_FOREMAN_URL and that foreman runs"

  @id=SCN-CONSOLE-040 @status=implemented
  Scenario: The page "/health" shows the checks and answers 503 when one fails
    Given a foreman that refuses the console's token
    When a person opens "/health"
    Then the page answers 503
    And its table has the row "foreman token", "failing", "foreman refuses the token: set CONSOLE_FOREMAN_TOKEN to its FOREMAN_API_TOKEN"
    And the page's navigation links "/health"

  @id=SCN-CONSOLE-048 @status=implemented
  Scenario: "console doctor" names a missing foreman URL, a server without "/v1/health" and a factory it cannot read
    Given a console without "CONSOLE_FOREMAN_URL"
    And an intake whose "/v1/health" answers 404
    And "CONSOLE_FACTORY" names a file that does not exist
    When the user runs "console doctor"
    Then it prints "FAIL  foreman: set CONSOLE_FOREMAN_URL to the base URL of the foreman's API"
    And it prints "FAIL  intake: <URL>/v1/health answered 404: update intake to a release with /v1/health"
    And it prints "FAIL  factory: ENOENT: no such file or directory, open '<file>': check CONSOLE_FACTORY"
