@module=testkit @owner=maintainers
Feature: Fake sandbox adapter
  fakes.sandbox is a program with the commands create, exec, copy, destroy and list of the sandbox port. A sandbox is a
  folder on the host, and exec runs the command there. It shows what a module asks of the port without Docker; it
  isolates nothing (ADR 0068).

  @id=SCN-TK-105 @status=implemented
  Scenario: The fake sandbox runs a command in its folder with the spec's variables and a placeholder for each secret
    Given a module whose CLI creates a sandbox with the adapter in "DEMO_SANDBOX_COMMAND" from a spec with the variable "CI" set to "true" and the secret "TOKEN" from "ref:file/token", and prints what "printenv CI TOKEN" prints in it
    And its system test expects "true" and "osf-secret-placeholder-TOKEN" and the spec the fake got
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-106 @status=implemented
  Scenario: A folder copied into the fake sandbox and out again keeps its files
    Given a module whose CLI copies the folder "work" into a sandbox of the adapter in "DEMO_SANDBOX_COMMAND", appends "done" to "work/notes.md" in it, and copies "work" out to "result"
    And its system test expects "result/notes.md" to say "draft" and "done", and the fake to show "notes.md" in the folder when the command started
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-107 @status=implemented
  Scenario: A destroyed fake sandbox leaves the list and refuses commands
    Given a module whose CLI creates a sandbox with the adapter in "DEMO_SANDBOX_COMMAND", destroys it, prints the list, and runs "pwd" in it
    And its system test expects an empty list, "no sandbox 000000000001" and the exit code 1
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-108 @status=implemented
  Scenario: The fake sandbox refuses a template outside its list
    Given a module whose CLI creates a sandbox with the adapter in "DEMO_SANDBOX_COMMAND" from a spec with the template "node:24"
    And its system test starts fakes.sandbox with the templates "alpine:3" and expects the exit code 1 and "no template node:24"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"
