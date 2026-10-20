@module=proof @owner=maintainers
Feature: Bundle a Playwright report
  "proof bundle --playwright <report.json>" reads Playwright's JSON report. A test belongs to the scenario IDs in its
  titles, tags or annotations. Its attachments with a file become artifacts of the bundle.

  @id=SCN-PROOF-003 @status=planned
  Scenario: A bundle records the scenario IDs it proves
    Given a Playwright report with the scenario ID "SCN-WEB-001" in a title, "SCN-WEB-002" in a tag and "SCN-WEB-003" in an annotation
    When the developer runs "proof bundle --playwright report.json"
    Then the command exits with code 0
    And the bundle lists the scenarios "SCN-WEB-001", "SCN-WEB-002" and "SCN-WEB-003" with the result "passed"

  @id=SCN-PROOF-004 @status=planned @realizes=SCN-FACTORY-LOOP-008
  Scenario: Screenshots and videos become artifacts with their checksum
    Given a Playwright report whose test "SCN-WEB-001 checkout" has the screenshot "checkout.png" and the video "video.webm"
    When the developer runs "proof bundle --playwright report.json"
    Then the bundle lists "artifacts/SCN-WEB-001/checkout.png" as "screenshot" with the media type "image/png"
    And the bundle lists "artifacts/SCN-WEB-001/video.webm" as "video" with the media type "video/webm"
    And each artifact in the bundle has the SHA-256 and the size of its file

  @id=SCN-PROOF-005 @status=planned
  Scenario: A failed test fails its scenario and the bundle
    Given a Playwright report where "SCN-WEB-001" passed and "SCN-WEB-002" has the status "unexpected"
    When the developer runs "proof bundle --playwright report.json"
    Then the command exits with code 0
    And the bundle lists the scenario "SCN-WEB-002" with the result "failed"
    And the bundle has the result "failed"

  @id=SCN-PROOF-006 @status=planned
  Scenario: A test that passed only on retry fails its scenario
    Given a Playwright report where the test of "SCN-WEB-001" has the status "flaky"
    When the developer runs "proof bundle --playwright report.json"
    Then the bundle lists the scenario "SCN-WEB-001" with the result "failed"

  @id=SCN-PROOF-007 @status=planned
  Scenario: A skipped test skips its scenario and fails the bundle
    Given a Playwright report where the test of "SCN-WEB-001" has the status "skipped"
    When the developer runs "proof bundle --playwright report.json"
    Then the bundle lists the scenario "SCN-WEB-001" with the result "skipped"
    And the bundle has the result "failed"

  @id=SCN-PROOF-008 @status=planned
  Scenario: A test without a scenario ID is left out and named
    Given a Playwright report with the tests "SCN-WEB-001 checkout" and "loads the home page"
    When the developer runs "proof bundle --playwright report.json"
    Then the command exits with code 0
    And the error output contains "no scenario ID: loads the home page"
    And the bundle lists only the scenario "SCN-WEB-001"

  @id=SCN-PROOF-009 @status=planned
  Scenario: A missing attachment file stops the bundle
    Given a Playwright report whose test "SCN-WEB-001 checkout" has the screenshot "missing.png" that does not exist
    When the developer runs "proof bundle --playwright report.json"
    Then the command exits with code 1
    And the error output contains "missing.png does not exist"
    And the output folder has no "evidence/evidence.json"
