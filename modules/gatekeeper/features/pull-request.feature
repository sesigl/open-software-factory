@module=gatekeeper @owner=maintainers
Feature: Gate a pull request
  With "--pull-request", the request is the pull request, the channel is its comments and the result is the commit
  status "gatekeeper" of its head commit.

  @id=SCN-GATE-029 @status=planned @realizes=SCN-FACTORY-IMPROVE-003
  Scenario: A factory-made pull request asks "maintainers" in a comment and waits
    Given the pull request "acme/web#12" from the branch "observer/research-skill-used-1a2b3c4d" on the forge
    And a policy that asks "maintainers" for a pull request from a branch "observer/"
    When the user runs "gatekeeper request" and then "gatekeeper status" for the pull request
    Then the pull request has a comment that asks "maintainers" to approve with "/approve"
    And the head commit of the pull request has the commit status "gatekeeper" with the state "pending"
    And the status command exits with code 3

  @id=SCN-GATE-030 @status=planned
  Scenario: A pull request that the policy does not gate passes without a person
    Given the pull request "acme/web#13" from the branch "claude/todo-t-11-gatekeeper" on the forge
    And a policy that asks "maintainers" for a pull request from a branch "observer/"
    When the user runs "gatekeeper status" for the pull request
    Then the command exits with code 0
    And the head commit of the pull request has the commit status "gatekeeper" with the state "success"
    And the pull request has no comment

  @id=SCN-GATE-031 @status=planned
  Scenario: An "/approve" comment of a maintainer passes the gate
    Given the pull request "acme/web#12" with the approval request of gatekeeper in a comment
    And the later comment "/approve" by "github:sesigl" of "maintainers"
    When the user runs "gatekeeper status" for the pull request
    Then the command exits with code 0
    And the head commit of the pull request has the commit status "gatekeeper" with the state "success" and the description "approved by github:sesigl"

  @id=SCN-GATE-032 @status=planned
  Scenario: An approval of an older commit does not count for a new commit
    Given the pull request "acme/web#12" with an "/approve" by "github:sesigl" before its new head commit
    And the approval request of gatekeeper for the new head commit after it
    When the user runs "gatekeeper status" for the pull request
    Then the command exits with code 3
    And the head commit of the pull request has the commit status "gatekeeper" with the state "pending"

  @id=SCN-GATE-033 @status=planned
  Scenario: A "/reject" comment of a maintainer fails the gate
    Given the pull request "acme/web#12" with the approval request of gatekeeper in a comment
    And the later comment "/reject Breaks the release" by "github:sesigl" of "maintainers"
    When the user runs "gatekeeper status" for the pull request
    Then the command exits with code 1
    And the head commit of the pull request has the commit status "gatekeeper" with the state "failure"
