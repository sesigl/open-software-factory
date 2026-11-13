@module=foreman @owner=maintainers
Feature: The run's pull request
  When the factory names a forge adapter and the work item comes from an issue of a forge, the run's branch is
  "osf/<run ID>" and the run's pull request is the one the forge adapter's "prs" lists with that head, else the one
  that the agent states in a line "Pull request: <link>". A link of another repository than the work item's is
  refused, and a stage that leaves the run without a pull request says why in its "note" (ADR 0109). The scenarios use
  the fake GitHub, the forge-github adapter, the README's "checks/factory.yaml", and the README's "work.json" whose
  origin is the issue "tester/web#3" of the fake GitHub.

  @id=SCN-FORE-126 @status=implemented
  Scenario: The run's pull request is the forge's pull request of the run's branch, not the last link the agent wrote
    Given "foreman serve" runs the README's "checks/factory.yaml" with the fake GitHub, whose pull request "tester/web#1" has the head "osf/<run ID>" and the check "verify" in the state "success", and whose pull request "tester/web#2" has another head
    And the scripted "implement" turn replies with the link of "tester/web#1" and then the link of "tester/web#2"
    When a program posts the README's "work.json" with the origin "tester/web#3" to "/v1/runs" with the API token
    Then "/v1/runs/<id>" shows the state "complete" and the link of "tester/web#1" as "pullRequest"
    And every prompt the harness received has the line "Branch: osf/<run ID>"

  @id=SCN-FORE-127 @status=implemented
  Scenario: The pull request the agent states is the run's when the forge has none of the run's branch
    Given "foreman serve" runs the README's "checks/factory.yaml" with the fake GitHub, whose pull requests "tester/web#1" and "tester/web#2" have other heads than "osf/<run ID>" and "tester/web#1" has the check "verify" in the state "success"
    And the scripted "implement" turn replies with the line "Pull request: <link of tester/web#1>" and then the link of "tester/web#2"
    When a program posts the README's "work.json" with the origin "tester/web#3" to "/v1/runs" with the API token
    Then "/v1/runs/<id>" shows the state "complete" and the link of "tester/web#1" as "pullRequest"

  @id=SCN-FORE-128 @status=implemented
  Scenario: A stated pull request of another repository than the work item's is refused
    Given "foreman serve" runs the README's "checks/factory.yaml" with the fake GitHub, whose repository "tester/app" has the pull request "tester/app#1"
    And the scripted "implement" turn replies with the line "Pull request: <link of tester/app#1>"
    When a program posts the README's "work.json" with the origin "tester/web#3" to "/v1/runs" with the API token
    Then "/v1/runs/<id>" shows the state "failed" with no "pullRequest" and the stage "ship" "failed" with the reason "no earlier stage linked a pull request"
    And the stage "implement" has the note "the pull request <link of tester/app#1> is not of the work item's repository <fake GitHub>/tester/web"

  @id=SCN-FORE-129 @status=implemented
  Scenario: A stage says so when the forge has no pull request of the run's branch and the agent states none
    Given "foreman serve" runs the README's "checks/factory.yaml" with the fake GitHub, whose pull request "tester/web#1" has another head than "osf/<run ID>"
    And the scripted "implement" turn replies with the link of "tester/web#1" in a sentence
    When a program posts the README's "work.json" with the origin "tester/web#3" to "/v1/runs" with the API token
    Then "/v1/runs/<id>" shows the state "failed" with no "pullRequest" and the stage "ship" "failed" with the reason "no earlier stage linked a pull request"
    And the stage "implement" has the note "no pull request of tester/web has the head osf/<run ID>, and the agent stated none"

  @id=SCN-FORE-130 @status=implemented
  Scenario: A stage whose forge adapter cannot list the pull requests succeeds and names the adapter's error
    Given "foreman serve" runs the README's "checks/factory.yaml" with the fake GitHub, whose pull request "tester/web#1" has the head "osf/<run ID>", and a forge adapter whose "prs" fails with "the forge is down"
    And the scripted "implement" turn replies with "done"
    When a program posts the README's "work.json" with the origin "tester/web#3" to "/v1/runs" with the API token
    Then "/v1/runs/<id>" shows the stage "implement" "succeeded" with the note "the forge adapter's prs failed: the forge is down"
