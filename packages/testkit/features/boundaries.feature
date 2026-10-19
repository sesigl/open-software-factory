@module=testkit @owner=maintainers
Feature: Runtime boundaries
  The module under test runs as its built artifact in its own process, keeps its state in a data folder the test
  cannot reach, and can reach only the testkit's fakes over the network (BOUNDARY-RUNTIME, NOREAL).

  @id=SCN-TK-023 @status=implemented
  Scenario: The module keeps its state in a private data folder
    Given a module whose CLI counts its runs in a file in "OSF_DATA" and prints the count
    And its system test runs it twice and expects "2" and no new file in $INPUT or $OUTPUT
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-024 @status=implemented
  Scenario: The sut refuses a module whose bin is a source file
    Given a module whose package.json bin is "src/demo.js"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 1
    And the output contains "BOUNDARY-RUNTIME: package.json starts src/demo.js; point bin at the built artifact"

  @id=SCN-TK-025 @status=implemented
  Scenario: A module that reaches a real host fails the scenario with the host shown
    Given a module whose CLI fetches "https://example.com/"
    And its system test runs it and expects any output
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 1
    And the output contains "NOREAL: the module tried to reach example.com:443"
