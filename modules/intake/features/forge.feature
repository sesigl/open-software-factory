@module=intake @owner=maintainers
Feature: Work from issues on the forge
  An issue on the forge that gets the label "factory" becomes a work item through the forge port's adapter. The issue's
  link is the dedupe key, so labeling it again adds nothing (ADR 0065).

  @id=SCN-INTAKE-021 @status=planned @realizes=SCN-FACTORY-ACCESS-001 @realizes=SCN-FACTORY-AUTO-001
  Scenario: A GitHub issue labeled "factory" becomes a work item with a link to the issue
    Given the server runs with the GitHub forge adapter and a webhook of "tester/web" for labels on issues
    When "tester" adds the label "factory" to the issue "Export reports as CSV"
    Then "/v1/work-items/<id of the issue's link>" shows the work item "Export reports as CSV" in the state "received"
    And it shows the requester "github:tester" and the origin "github" with the issue's link

  @id=SCN-INTAKE-022 @status=planned
  Scenario: An issue labeled with another label makes no work item
    Given the server runs with the GitHub forge adapter and a webhook of "tester/web" for labels on issues
    When "tester" adds the label "question" to the issue "Export reports as CSV"
    Then "/v1/work-items/<id of the issue's link>" answers the status 404

  @id=SCN-INTAKE-023 @status=planned
  Scenario: A forge delivery with a wrong signature gets the status 401 and makes no work item
    Given the server runs with the GitHub forge adapter and "INTAKE_WEBHOOK_SECRET" set to "whsec-51c2"
    When a delivery of the label "factory" on an issue arrives signed with "whsec-other"
    Then the answer has the status 401
    And "/v1/work-items/<id of the issue's link>" answers the status 404
