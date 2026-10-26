@module=foreman @owner=maintainers
Feature: Checks before a stage
  A stage that names checks in "factory.yaml" starts only when those checks succeeded on the run's pull request: the
  last pull request link that an agent of an earlier stage wrote. The foreman reads the checks through the forge port
  (ADR 0069). The scenarios use the fake GitHub, the forge-github adapter and the README's "checks/factory.yaml", whose
  stage "ship" waits for the check "verify".

  @id=SCN-FORE-042 @status=planned @realizes=SCN-FACTORY-ORCH-004
  Scenario: A failing check stops the stage that waits for it
    Given "foreman serve" runs the README's "checks/factory.yaml" with the fake GitHub, whose pull request "tester/web#1" has the check "verify" in the state "failure"
    And the scripted "implement" turn replies with the link of that pull request
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then "/v1/runs/<id>" shows the state "failed" with the stage "ship" "failed" and its check "verify" "failure"
    And the harness never received the prompt "Merge the pull request"

  @id=SCN-FORE-043 @status=planned @realizes=SCN-FACTORY-ORCH-004
  Scenario: A stage starts when its checks succeeded
    Given "foreman serve" runs the README's "checks/factory.yaml" with the fake GitHub, whose pull request "tester/web#1" has the check "verify" in the state "success"
    And the scripted "implement" turn replies with the link of that pull request
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then "/v1/runs/<id>" shows the state "complete" with the stage "ship" "succeeded" and its check "verify" "success"
    And the prompt of the "ship" stage names the pull request's link

  @id=SCN-FORE-044 @status=planned
  Scenario: A pending check holds the stage until it succeeds
    Given a run of the README's "checks/factory.yaml" that is "blocked" with the stage "ship" "blocked" because the check "verify" of its pull request is "pending"
    When the fake GitHub sets the check "verify" of the pull request to "success"
    Then "/v1/runs/<id>" shows the state "complete" with the stage "ship" "succeeded"

  @id=SCN-FORE-045 @status=planned
  Scenario: A check the pull request does not have yet holds the stage
    Given "foreman serve" runs the README's "checks/factory.yaml" with the fake GitHub, whose pull request "tester/web#1" has no check
    And the scripted "implement" turn replies with the link of that pull request
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then "/v1/runs/<id>" shows the state "blocked" with the stage "ship" "blocked" and its check "verify" "pending"

  @id=SCN-FORE-046 @status=planned
  Scenario: A stage with checks fails when no earlier stage linked a pull request
    Given "foreman serve" runs the README's "checks/factory.yaml" with the fake GitHub and a scripted harness whose turns name no pull request
    When a program posts the README's "work.json" to "/v1/runs" with the API token
    Then "/v1/runs/<id>" shows the state "failed" with the stage "ship" "failed" and the reason "no earlier stage linked a pull request"
    And the harness never received the prompt "Merge the pull request"

  @id=SCN-FORE-047 @status=planned
  Scenario: A run shows its pull request and publishes it when it ends
    Given "foreman serve" runs the README's "checks/factory.yaml" with the fake GitHub and NATS, whose pull request "tester/web#1" has the check "verify" in the state "success"
    And the scripted "implement" turn replies with the link of that pull request
    When a program posts the README's "work.json" to "/v1/runs" with the API token and the run completes
    Then "/v1/runs/<id>" shows the pull request's link as "pullRequest"
    And the "run.completed@v1" on "osf.run.completed.v1" lists the pull request's link in "pullRequests"

  @id=SCN-FORE-048 @status=planned
  Scenario: A cancel ends a run that waits for a check
    Given a run of the README's "checks/factory.yaml" that is "blocked" with the stage "ship" "blocked" because the check "verify" of its pull request is "pending"
    When a program posts the signal "cancel" to "/v1/runs/<id>/signals"
    Then "/v1/runs/<id>" shows the state "cancelled" with the stage "ship" "cancelled"

  @id=SCN-FORE-049 @status=planned
  Scenario: A factory with checks but without a forge adapter stops the server at the start
    Given the README's "checks/factory.yaml" without "providers.forge"
    When the user runs "foreman serve"
    Then the command exits with code 2
    And the output contains "factory.yaml: /workflow/2/checks: name one forge adapter under providers.forge"
