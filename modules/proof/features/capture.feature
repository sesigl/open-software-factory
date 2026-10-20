@module=proof @owner=maintainers
Feature: Capture a running product
  "proof capture <url> --scenario <id>" opens the page in headless Chromium and keeps a screenshot, a video and a
  Playwright trace of it. "proof capture --from <folder> --scenario <id>" takes the files that Playwright MCP or
  another tool saved. Both write the files to "<out>/<scenario ID>/" and add the scenario to "<out>/report.json", a
  Playwright JSON report that "proof bundle --playwright" reads. The default for --out is "$OUTPUT/capture".

  @id=SCN-PROOF-035 @status=planned @realizes=SCN-FACTORY-LOOP-008
  Scenario: A capture keeps a screenshot, a video and a trace of the page
    Given a running product whose page "/checkout" shows "Pay with a card"
    When the developer runs "proof capture <product>/checkout --scenario SCN-WEB-001"
    Then the command exits with code 0
    And the capture report lists "SCN-WEB-001" as "expected" with a "screenshot", a "video" and a "trace"
    And "$OUTPUT/capture/SCN-WEB-001/page.png" is a PNG image

  @id=SCN-PROOF-036 @status=planned
  Scenario: A page without the expected text fails the capture
    Given a running product whose page "/checkout" shows "Pay with a card"
    When the developer runs "proof capture <product>/checkout --scenario SCN-WEB-001 --expect \"Thank you\""
    Then the command exits with code 1
    And the error output contains "SCN-WEB-001: the page does not show \"Thank you\""
    And the capture report lists "SCN-WEB-001" as "unexpected" with a "screenshot", a "video" and a "trace"

  @id=SCN-PROOF-037 @status=planned
  Scenario: A page that answers with an error fails the capture
    Given a running product whose page "/checkout" answers 500
    When the developer runs "proof capture <product>/checkout --scenario SCN-WEB-001"
    Then the command exits with code 1
    And the error output contains "SCN-WEB-001: <product>/checkout answered 500"

  @id=SCN-PROOF-038 @status=planned
  Scenario: A second capture adds its scenario to the report
    Given a running product whose pages "/checkout" and "/receipt" show "Pay with a card" and "Thank you"
    And the developer captured "<product>/checkout" for "SCN-WEB-001"
    When the developer runs "proof capture <product>/receipt --scenario SCN-WEB-002"
    Then the command exits with code 0
    And the capture report lists the scenarios "SCN-WEB-001" and "SCN-WEB-002"

  @id=SCN-PROOF-039 @status=planned @realizes=SCN-FACTORY-LOOP-008
  Scenario: The files of a Playwright MCP session become a capture
    Given a folder "mcp" with the files "page-1.png", "videos/checkout.webm", "traces/session.zip" and "notes.md"
    When the developer runs "proof capture --from mcp --scenario SCN-WEB-002"
    Then the command exits with code 0
    And the capture report lists "SCN-WEB-002" as "expected" with a "screenshot", a "video" and a "trace"
    And "$OUTPUT/capture/SCN-WEB-002" holds "page-1.png", "videos/checkout.webm" and "traces/session.zip" but not "notes.md"

  @id=SCN-PROOF-040 @status=planned
  Scenario: A folder without screenshots, videos or traces is refused
    Given a folder "mcp" with the file "notes.md"
    When the developer runs "proof capture --from mcp --scenario SCN-WEB-002"
    Then the command exits with code 1
    And the error output contains "mcp has no screenshot, video or trace"

  @id=SCN-PROOF-041 @status=planned
  Scenario: A capture without a scenario is refused
    When the developer runs "proof capture http://127.0.0.1:9/checkout"
    Then the command exits with code 1
    And the error output contains "give the scenario with --scenario"

  @id=SCN-PROOF-042 @status=planned
  Scenario: A capture bundles into evidence for its scenario
    Given a Git repository with one commit and a running product whose page "/checkout" shows "Pay with a card"
    And the developer ran "proof capture <product>/checkout --scenario SCN-WEB-001 --out capture"
    When the developer runs "proof bundle --playwright capture/report.json"
    Then the command exits with code 0
    And the bundle lists the "screenshot", the "video" and the "playwright-trace" of "SCN-WEB-001"
