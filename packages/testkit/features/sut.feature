@module=testkit @owner=maintainers
Feature: The sut handle
  A system test drives the module under test only through sut: its CLI, its README, and its input and output
  folders.

  @id=SCN-TK-003 @status=implemented
  Scenario: sut.readme gives the quick start command and the file it promises
    Given a module whose README quick start runs "npx demo hello" and promises "$OUTPUT/hello.txt"
    And its system test runs the arguments of sut.readme.quickStartArgs and expects the file of sut.readme.quickStartOutput
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-004 @status=implemented
  Scenario: sut.files.clear empties a folder
    Given a module whose system test puts "$INPUT/a.txt", runs sut.files.clear on "$INPUT" and expects an empty list of "$INPUT"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-005 @status=implemented
  Scenario: The module runs with a fixed clock and seed
    Given a module whose CLI prints the environment variables "OSF_NOW" and "OSF_SEED"
    And its system test expects the output "2026-01-01T00:00:00Z 1"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"
