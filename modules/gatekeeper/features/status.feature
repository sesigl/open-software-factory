@module=gatekeeper @owner=maintainers
Feature: Decide a gate
  "gatekeeper status" reads the thread of the approval request and decides the gate by the rules of the policy.

  @id=SCN-GATE-013 @status=implemented @realizes=SCN-FACTORY-ORCH-003
  Scenario: A member of the approver group approves in the thread
    Given the approval request of the README request in the Slack channel "C0GATES"
    And "slack:U0ADA" of "maintainers" replied "approve" in its thread
    When the user runs "gatekeeper status" with the same arguments
    Then the command exits with code 0
    And the output says "approved by slack:U0ADA"
    And the thread has the reply "Approved by <@U0ADA>"

  @id=SCN-GATE-014 @status=implemented
  Scenario: The record names the approver and the time
    Given the approval request of the README request in the Slack channel "C0GATES"
    And "slack:U0ADA" of "maintainers" replied "approve" in its thread with the Slack time "1767225600.000002"
    When the user runs "gatekeeper status" with the same arguments
    Then "$OUTPUT/record.json" has the decision "approved" by the person "slack:U0ADA" at "2026-01-01T00:00:00.000002Z"
    And the record names the gate, the work item "https://github.com/acme/web/pull/6", the stage "merge" and the approver group "maintainers"

  @id=SCN-GATE-015 @status=implemented
  Scenario: A member rejects with a reason
    Given the approval request of the README request in the Slack channel "C0GATES"
    And "slack:U0ADA" of "maintainers" replied "reject Needs a migration plan" in its thread
    When the user runs "gatekeeper status" with the same arguments
    Then the command exits with code 1
    And "$OUTPUT/record.json" has the decision "rejected" with the reason "Needs a migration plan"

  @id=SCN-GATE-016 @status=implemented
  Scenario: A decision by a person outside the approver group is refused
    Given the approval request of the README request in the Slack channel "C0GATES"
    And "slack:U0EVE", who is in no group, replied "approve" in its thread
    When the user runs "gatekeeper status" with the same arguments
    Then the command exits with code 3
    And the thread has the reply "<@U0EVE> is not in maintainers"
    And the output folder has no "record.json"

  @id=SCN-GATE-017 @status=implemented
  Scenario: A refused decision gets one reply, however often status runs
    Given the approval request of the README request in the Slack channel "C0GATES"
    And "slack:U0EVE", who is in no group, replied "approve" in its thread
    When the user runs "gatekeeper status" with the same arguments twice
    Then the thread has one reply that says "<@U0EVE> is not in maintainers"

  @id=SCN-GATE-018 @status=implemented
  Scenario: A gate without a decision waits
    Given the approval request of the README request in the Slack channel "C0GATES"
    When the user runs "gatekeeper status" with the same arguments
    Then the command exits with code 3
    And the output says "waiting for maintainers"

  @id=SCN-GATE-019 @status=implemented
  Scenario: A gate without a decision after its timeout asks the escalation group
    Given the approval request of the README request, made at "2026-01-01T00:00:00Z" with "escalate_after" "4h" to "leads"
    When the user runs "gatekeeper status" with the same arguments at "2026-01-01T05:00:00Z"
    Then the command exits with code 3
    And the thread has a reply that asks "leads" to approve
    And the output says "waiting for maintainers, leads"

  @id=SCN-GATE-020 @status=implemented
  Scenario: A member of the escalation group approves after the escalation
    Given the approval request of the README request, escalated to "leads" at "2026-01-01T05:00:00Z"
    And "slack:U0LEO" of "leads" replied "approve" in its thread after the escalation
    When the user runs "gatekeeper status" with the same arguments at "2026-01-01T05:10:00Z"
    Then the command exits with code 0
    And the output says "approved by slack:U0LEO"

  @id=SCN-GATE-021 @status=implemented
  Scenario: A member of the escalation group cannot decide before the escalation
    Given the approval request of the README request in the Slack channel "C0GATES"
    And "slack:U0LEO" of "leads" replied "approve" in its thread
    When the user runs "gatekeeper status" with the same arguments
    Then the command exits with code 3
    And the thread has the reply "<@U0LEO> is not in maintainers"

  @id=SCN-GATE-022 @status=implemented
  Scenario: A gate without a decision expires after "expire_after"
    Given the approval request of the README request, made with the Slack time "1767225600.000001" and "expire_after" "2d"
    When the user runs "gatekeeper status" with the same arguments at "2026-01-03T01:00:00Z"
    Then the command exits with code 1
    And "$OUTPUT/record.json" has the decision "expired" at "2026-01-03T00:00:00.000001Z" and no person
    And the thread has the reply "Expired"

  @id=SCN-GATE-023 @status=implemented
  Scenario: Status before any request exits 1
    Given the README policy, groups and request, and no approval request in the Slack channel "C0GATES"
    When the user runs "gatekeeper status" for the channel "slack:C0GATES"
    Then the command exits with code 1
    And the error output says that "slack:C0GATES" has no request for the gate and to run "gatekeeper request" first

  @id=SCN-GATE-024 @status=implemented
  Scenario: A text that looks like gatekeeper's marker but comes from a person is no request
    Given the README policy, groups and request
    And "slack:U0EVE" posted the request's marker text in the Slack channel "C0GATES"
    When the user runs "gatekeeper status" for the channel "slack:C0GATES"
    Then the command exits with code 1
    And the error output says that "slack:C0GATES" has no request for the gate and to run "gatekeeper request" first

  @id=SCN-GATE-025 @status=implemented
  Scenario: A decision is published as the event "gate.decided@v1"
    Given the approval request of the README request in the Slack channel "C0GATES"
    And "slack:U0ADA" of "maintainers" replied "approve" in its thread
    And "GATEKEEPER_NATS_URL" set to a NATS server
    When the user runs "gatekeeper status" with the same arguments
    Then the event "gate.decided@v1" arrives on "osf.gate.decided.v1"
    And the event has the decision "approved" by the person "slack:U0ADA"
