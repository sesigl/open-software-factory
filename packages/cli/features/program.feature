@module=cli @owner=maintainers
Feature: A program with commands
  A module's command line runs one command with runProgram: the command's lines go to standard output, its errors to
  standard error after the program's name, and the exit code says how it ended.

  @id=SCN-CLI-001 @status=implemented
  Scenario: The lines of a command go to standard output
    Given the program "demo" whose command gives the lines "a" and "b"
    When the module runs the program
    Then the exit code is 0
    And standard output is "a", "b", each on its own line
    And standard error is empty

  @id=SCN-CLI-002 @status=implemented
  Scenario: The errors of a command go to standard error after the program's name
    Given the program "demo" whose command gives the error "one run failed" and no lines
    When the module runs the program
    Then the exit code is 1
    And standard error is "demo: one run failed", each on its own line
    And standard output is empty

  @id=SCN-CLI-003 @status=implemented
  Scenario: A command chooses its exit code
    Given the program "demo" whose command gives the line "agreement 0.50" and the exit code 1
    When the module runs the program
    Then the exit code is 1
    And standard output is "agreement 0.50", each on its own line

  @id=SCN-CLI-004 @status=implemented
  Scenario: A usage error exits 2
    Given the program "demo" whose command throws the usage error "--since takes a date like 2026-01-31"
    When the module runs the program
    Then the exit code is 2
    And standard error is "demo: --since takes a date like 2026-01-31", each on its own line
    And standard output is empty

  @id=SCN-CLI-005 @status=implemented
  Scenario: Any other error exits 1
    Given the program "demo" whose command throws the error "connection refused"
    When the module runs the program
    Then the exit code is 1
    And standard error is "demo: connection refused", each on its own line

  @id=SCN-CLI-006 @status=implemented
  Scenario: check throws a usage error unless its condition holds
    Given the program "demo" whose command checks that 0 paths were named, with the message "name at least one file"
    When the module runs the program
    Then the exit code is 2
    And standard error is "demo: name at least one file", each on its own line

  @id=SCN-CLI-015 @status=implemented
  Scenario: check lets the command go on when its condition holds
    Given the program "demo" whose command checks that 1 path was named, with the message "name at least one file", and gives the line "runs.jsonl"
    When the module runs the program
    Then the exit code is 0
    And standard output is "runs.jsonl", each on its own line

  @id=SCN-CLI-007 @status=implemented
  Scenario: --help prints the usage to standard output
    Given the program "demo" with the usage "Usage: demo <command>"
    When the module runs the program with --help
    Then the exit code is 0
    And standard output is "Usage: demo <command>", each on its own line
    And standard error is empty

  @id=SCN-CLI-008 @status=implemented
  Scenario: No command prints the usage to standard error
    Given the program "demo" with the usage "Usage: demo <command>"
    When the module runs the program without a command
    Then the exit code is 2
    And standard error is "Usage: demo <command>", each on its own line
    And standard output is empty
