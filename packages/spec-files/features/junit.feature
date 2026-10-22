@module=spec-files @owner=maintainers
Feature: JUnit reports
  parseJUnit reads a JUnit XML report into its test cases; scenarioIdOf finds the scenario a test case proves.

  @id=SCN-SPECFILES-005 @status=implemented
  Scenario: parseJUnit gives each test case with its suite, status, properties and time
    Given a JUnit report with the suite "system-tests/a.test.ts" and the test cases "passes" (1.5 seconds, property "scenario" "SCN-DEMO-001"), "fails" with a failure, "errs" with an error and "skips" skipped, and the empty suite "empty"
    When the module parses the report
    Then it gets "passes" as passed after 1.5 seconds in the suite "system-tests/a.test.ts" with the property "scenario" "SCN-DEMO-001"
    And it gets "fails" and "errs" as failed and "skips" as skipped, each without properties, and no other test case

  @id=SCN-SPECFILES-006 @status=implemented
  Scenario: parseJUnit counts the reruns of a test case
    Given a JUnit report whose test case "flaky" has one "flakyFailure", one "flakyError", one "rerunFailure" and one "rerunError" element
    When the module parses the report
    Then "flaky" has 4 reruns and the status passed

  @id=SCN-SPECFILES-007 @status=implemented
  Scenario: parseJUnit reads a report whose root is a single test suite
    Given a JUnit report whose root element is the suite "demo" with the test case "only"
    When the module parses the report
    Then it gets the test case "only" in the suite "demo"

  @id=SCN-SPECFILES-008 @status=implemented
  Scenario: readJUnitFolder reads every XML file of a folder by file name
    Given the folder "$INPUT/junit" with "b.xml" holding the test case "second", "a.xml" holding "first" and "notes.txt"
    When the module reads the folder
    Then it gets the test cases "first" and "second" in this order

  @id=SCN-SPECFILES-009 @status=implemented
  Scenario: readJUnitFolder gives nothing for a folder without reports
    Given the folder "$INPUT/junit" with only "notes.txt"
    When the module reads the folder and the missing folder "$INPUT/none"
    Then it gets undefined for both

  @id=SCN-SPECFILES-010 @status=implemented
  Scenario: scenarioIdOf takes the property "scenario" first
    Given the test case "SCN-DEMO-002 works" with the property "scenario" "SCN-DEMO-001"
    When the module asks for its scenario ID with the pattern "SCN-[A-Z]+-\d{3}"
    Then it gets "SCN-DEMO-001"

  @id=SCN-SPECFILES-011 @status=implemented
  Scenario: scenarioIdOf finds the ID in the name, else in the class name
    Given the test case "SCN-DEMO-002 works" in the class "system-tests/SCN-DEMO-003.test.ts" and the test case "works" in the same class, and the test case "works" in the class "system-tests/a.test.ts"
    When the module asks for the scenario ID of each with the pattern "SCN-[A-Z]+-\d{3}"
    Then it gets "SCN-DEMO-002" for the first, "SCN-DEMO-003" for the second and no ID for the third
