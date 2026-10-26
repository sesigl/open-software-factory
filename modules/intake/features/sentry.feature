@module=intake @owner=maintainers
Feature: Work from Sentry
  A Sentry alert about a fatal error becomes a "bug" work item that links the error and the release it happened in.
  Sentry signs each delivery with the client secret of its integration (ADR 0065).

  @id=SCN-INTAKE-026 @status=planned @realizes=SCN-FACTORY-LOOP-003 @realizes=SCN-FACTORY-LOOP-002
  Scenario: A Sentry alert about a fatal error becomes a bug work item that links the error and the change
    Given the server runs with "INTAKE_SENTRY_SECRET" and "INTAKE_SENTRY_CHANGE_URL" set to "https://github.com/acme/web/commit/{release}"
    When Sentry sends the signed alert "TypeError: total is undefined" of level "fatal" in the release "4c5d6e7"
    Then "/v1/work-items/<id>" shows a work item of type "bug" with the title "TypeError: total is undefined"
    And it links the error in Sentry and "https://github.com/acme/web/commit/4c5d6e7"
    And it shows the requester "sentry:fatal-errors" and the origin "sentry" with the link to the error

  @id=SCN-INTAKE-027 @status=planned
  Scenario: A Sentry alert about an error that is not fatal makes no work item
    Given the server runs with "INTAKE_SENTRY_SECRET"
    When Sentry sends the signed alert "TypeError: total is undefined" of level "error"
    Then the answer has the status 200
    And "/v1/work-items/<id of the Sentry issue>" answers the status 404

  @id=SCN-INTAKE-028 @status=planned
  Scenario: A Sentry delivery with a wrong signature gets the status 401
    Given the server runs with "INTAKE_SENTRY_SECRET"
    When the alert "TypeError: total is undefined" of level "fatal" arrives signed with another secret
    Then the answer has the status 401
