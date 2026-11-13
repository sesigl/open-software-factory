@module=intake @owner=maintainers
Feature: Work from issues on the forge
  An issue on the forge that gets the label "factory" becomes a work item through the forge port's adapter. The issue's
  link is the dedupe key, so labeling it again makes no second work item (ADR 0065). The label put on again asks to
  run a failed or cancelled work item again (ADR 0105).

  @id=SCN-INTAKE-021 @status=implemented @realizes=SCN-FACTORY-ACCESS-001 @realizes=SCN-FACTORY-AUTO-001
  Scenario: A GitHub issue labeled "factory" becomes a work item with a link to the issue
    Given the server runs with the GitHub forge adapter and a webhook of "tester/web" for labels on issues
    When "tester" adds the label "factory" to the issue "Export reports as CSV"
    Then "/v1/work-items/<id of the issue's link>" shows the work item "Export reports as CSV" in the state "received"
    And it shows the requester "github:tester" and the origin "github" with the issue's link

  @id=SCN-INTAKE-022 @status=implemented
  Scenario: An issue labeled with another label makes no work item
    Given the server runs with the GitHub forge adapter and a webhook of "tester/web" for labels on issues
    When "tester" adds the label "question" to the issue "Export reports as CSV"
    Then "/v1/work-items/<id of the issue's link>" answers the status 404

  @id=SCN-INTAKE-023 @status=implemented
  Scenario: A forge delivery with a wrong signature gets the status 401 and makes no work item
    Given the server runs with the GitHub forge adapter and "INTAKE_WEBHOOK_SECRET" set to "whsec-51c2"
    When a delivery of the label "factory" on an issue arrives signed with "whsec-other"
    Then the answer has the status 401
    And "/v1/work-items/<id of the issue's link>" answers the status 404

  @id=SCN-INTAKE-059 @status=implemented
  Scenario: The issue of a work item gets a comment when its run was cancelled
    Given the server, with "INTAKE_NATS_URL" set to a NATS server and the GitHub forge adapter with "INTAKE_FORGE_TOKEN", made a work item of the issue "Export reports as CSV" labeled "factory"
    When the foreman publishes "run.completed@v1" for the work item with the outcome "cancelled"
    Then the issue has the one comment "The run ended with the outcome cancelled: run_5d41402abc4b2a76b971"
