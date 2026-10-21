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

  @id=SCN-TK-033 @status=implemented
  Scenario: sut.action runs the module's GitHub Action with its inputs
    Given a module whose composite action.yml has the input "name", checks "github.action_path" and "github.token", and runs its "command" with the name in a "run" step
    And its system test runs sut.action with the input "name" set to "web" and expects the output "hello web" and the step output "greeting"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-034 @status=implemented
  Scenario: sut.action gives the action the event of the workflow run
    Given a module whose composite action.yml prints "GITHUB_EVENT_NAME" and the pull request number of the event in "GITHUB_EVENT_PATH"
    And its system test runs sut.action with a pull request event of the number 7 and expects the output "pull_request 7"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-035 @status=implemented
  Scenario: An expression sut.action does not support fails the test
    Given a module whose composite action.yml runs "echo ${{ github.event.number }}"
    And its system test runs sut.action
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 1
    And the output contains "sut.action supports only inputs.<name>, github.action_path and github.token: ${{ github.event.number }}"

  @id=SCN-TK-036 @status=implemented
  Scenario: The module finds the browsers Playwright installed
    Given a module whose CLI prints the environment variable "PLAYWRIGHT_BROWSERS_PATH"
    And its system test expects the output "/opt/browsers"
    When the developer runs "testkit run --junit report.xml" with PLAYWRIGHT_BROWSERS_PATH "/opt/browsers" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-038 @status=implemented
  Scenario: The first failing step ends the action with its exit code
    Given a module whose composite action.yml runs "exit 3" in its first step and "echo second" in its second
    And its system test runs sut.action and expects the exit code 3 without the output "second"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-039 @status=implemented
  Scenario: A run step with a condition fails the test
    Given a module whose composite action.yml has a "run" step with "if: always()"
    And its system test runs sut.action
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 1
    And the output contains "sut.action runs only \"run\" steps with \"shell: bash\" and without \"if:\", not step 1"

  @id=SCN-TK-040 @status=implemented
  Scenario: An input the action does not declare fails the test
    Given a module whose composite action.yml has the inputs "name" and "command"
    And its system test runs sut.action with the input "nmae"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 1
    And the output contains "sut.action: action.yml has no input \"nmae\""

  @id=SCN-TK-041 @status=planned
  Scenario: sut.action gives the action a job summary and returns its text
    Given a module whose composite action.yml writes "## demo" to the file in "GITHUB_STEP_SUMMARY"
    And its system test runs sut.action and expects the job summary "## demo"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"
