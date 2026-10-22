@module=gatekeeper @owner=maintainers
Feature: Request an approval
  "gatekeeper request" asks the policy which groups must approve a change and asks them in the channel.

  @id=SCN-GATE-004 @status=implemented @realizes=SCN-FACTORY-IMPROVE-003
  Scenario: The policy asks "maintainers" for a change of high risk
    Given the README policy, which gives the risk "high" to a change of a path below "contracts/"
    And a request for a change of "contracts/score.tsp"
    When the user runs "gatekeeper request" for the channel "slack:C0GATES"
    Then the command exits with code 0
    And the Slack channel "C0GATES" has a message that asks "maintainers" to approve the change with the risk "high"
    And "$OUTPUT/gate.json" names the approver group "maintainers" and the risk "high"

  @id=SCN-GATE-005 @status=implemented
  Scenario: The policy asks "reviewers" for a change of low risk
    Given the README policy, which gives the risk "low" to a change outside "contracts/"
    And a request for a change of "README.md"
    When the user runs "gatekeeper request" for the channel "slack:C0GATES"
    Then the command exits with code 0
    And the Slack channel "C0GATES" has a message that asks "reviewers" to approve the change with the risk "low"

  @id=SCN-GATE-006 @status=implemented
  Scenario: The same request twice asks only once
    Given the README policy and groups
    And the approval request of the README request in the Slack channel "C0GATES"
    When the user runs "gatekeeper request" for the same request again
    Then the command exits with code 0
    And the output says "already requested"
    And the Slack channel "C0GATES" has one approval request

  @id=SCN-GATE-007 @status=implemented
  Scenario: A policy that names no approver group approves without a person
    Given a policy whose "approvers" is empty for a change of "docs/guide.md"
    And a request for a change of "docs/guide.md"
    When the user runs "gatekeeper request" for the channel "slack:C0GATES"
    Then the command exits with code 0
    And the output says "approved by the policy"
    And "$OUTPUT/record.json" has the decision "approved" by the trigger "policy:policy.rego"
    And the Slack channel "C0GATES" has no message

  @id=SCN-GATE-008 @status=implemented
  Scenario: A group that the groups file does not define exits 2
    Given a policy that names the approver group "security"
    And a groups file without "security"
    When the user runs "gatekeeper request" for the channel "slack:C0GATES"
    Then the command exits with code 2
    And the error output says that the policy names the group "security", which the groups file does not define
    And the Slack channel "C0GATES" has no message

  @id=SCN-GATE-009 @status=implemented
  Scenario: A request without a work item exits 2 and names the field
    Given the README policy and groups
    And a request without "workItem"
    When the user runs "gatekeeper request" for the channel "slack:C0GATES"
    Then the command exits with code 2
    And the error output names the field "workItem"

  @id=SCN-GATE-010 @status=implemented
  Scenario: Without OPA the command says how to install it
    Given the README policy, groups and request
    And "GATEKEEPER_OPA" set to a file that does not exist
    When the user runs "gatekeeper request" for the channel "slack:C0GATES"
    Then the command exits with code 1
    And the error output says to install OPA or to set "GATEKEEPER_OPA"

  @id=SCN-GATE-011 @status=implemented
  Scenario: A policy that OPA cannot read exits 2 with OPA's message
    Given a policy file "policy.rego" with the line "approvers contains" and nothing after it
    And the README groups and request
    When the user runs "gatekeeper request" for the channel "slack:C0GATES"
    Then the command exits with code 2
    And the error output names "policy.rego" and the line 3

  @id=SCN-GATE-012 @status=implemented
  Scenario: A request is published as the event "gate.requested@v1"
    Given the README policy, groups and request
    And "GATEKEEPER_NATS_URL" set to a NATS server
    When the user runs "gatekeeper request" for the channel "slack:C0GATES"
    Then the event "gate.requested@v1" arrives on "osf.gate.requested.v1"
    And the event names the stage "merge", the approver group "maintainers" and the policy "policy.rego"

  @id=SCN-GATE-039 @status=implemented
  Scenario: A groups file that is not JSON exits 2 and names the file
    Given the README policy and request
    And a groups file "groups.json" with the text "maintainers: slack:U0ADA"
    When the user runs "gatekeeper request" for the channel "slack:C0GATES"
    Then the command exits with code 2
    And the error output says "groups.json is not JSON"
