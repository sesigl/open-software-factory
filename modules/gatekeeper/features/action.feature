@module=gatekeeper @owner=maintainers
Feature: GitHub Action
  The action gates the pull request of a workflow run: it asks for approval and sets the commit status.

  @id=SCN-GATE-034 @status=implemented
  Scenario: The action asks for approval of a factory-made pull request and waits
    Given the pull request "acme/web#12" from the branch "observer/research-skill-used-1a2b3c4d" on the forge
    And the policy and groups files of the workflow
    When a pull request workflow runs the action
    Then the action succeeds
    And the action output "decision" is "pending"
    And the head commit of the pull request has the commit status "gatekeeper" with the state "pending"

  @id=SCN-GATE-035 @status=implemented
  Scenario: The action fails when a maintainer rejects the pull request
    Given the pull request "acme/web#12" with the approval request of gatekeeper and the later comment "/reject Breaks the release" by "github:sesigl"
    And the policy and groups files of the workflow
    When a workflow on the new comment runs the action
    Then the action fails
    And the action output "decision" is "rejected"

  @id=SCN-GATE-036 @status=implemented
  Scenario: The action names the record of an approved pull request
    Given the pull request "acme/web#12" with the approval request of gatekeeper and the later comment "/approve" by "github:sesigl"
    And the policy and groups files of the workflow
    When a workflow on the new comment runs the action
    Then the action succeeds
    And the record named in the action output "record" has the decision "approved" by the person "github:sesigl"
