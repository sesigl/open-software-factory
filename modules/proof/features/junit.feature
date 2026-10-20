@module=proof @owner=maintainers
Feature: Bundle a JUnit report
  "proof bundle --junit <report.xml>" reads a JUnit XML report. A test case belongs to the scenario ID in its
  property "scenario", or else in its name. The report itself is the artifact of each of its scenarios.

  @id=SCN-PROOF-010 @status=implemented
  Scenario: The scenario property of a test case names its scenario
    Given a JUnit report with a passed test case that has the property "scenario" "SCN-API-001" and a failed one with "SCN-API-002"
    When the developer runs "proof bundle --junit report.xml"
    Then the command exits with code 0
    And the bundle lists the scenario "SCN-API-001" with the result "passed" and the artifact "junit/report.xml"
    And the bundle lists the scenario "SCN-API-002" with the result "failed" and the artifact "junit/report.xml"
    And the bundle lists "junit/report.xml" as "junit" with the media type "application/xml"

  @id=SCN-PROOF-011 @status=implemented
  Scenario: A test case without the property is named by the ID in its name
    Given a JUnit report with the test case "SCN-API-003 creates an order" and a skipped test case "SCN-API-004 deletes an order"
    When the developer runs "proof bundle --junit report.xml"
    Then the bundle lists the scenario "SCN-API-003" with the result "passed"
    And the bundle lists the scenario "SCN-API-004" with the result "skipped"

  @id=SCN-PROOF-012 @status=implemented
  Scenario: Playwright and JUnit evidence of one scenario join in one entry
    Given a Playwright report whose test "SCN-WEB-001 checkout" has the screenshot "checkout.png"
    And a JUnit report with a passed test case that has the property "scenario" "SCN-WEB-001"
    When the developer runs "proof bundle --playwright report.json --junit report.xml"
    Then the bundle lists the scenario "SCN-WEB-001" once, with the artifacts "artifacts/SCN-WEB-001/checkout.png" and "junit/report.xml"
