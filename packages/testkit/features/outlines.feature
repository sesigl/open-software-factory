@module=testkit @owner=maintainers
Feature: Scenario Outlines
  The test of a Scenario Outline is one scenario() call. It reads the rows of the Outline's Examples from the feature
  file and runs its steps once for each row, each with a workspace of its own, as one test case (ADR 0157).

  @id=SCN-TK-201 @status=implemented
  Scenario: The test of an Outline runs once for each row, each in a workspace of its own, as one passed test case
    Given a module whose Outline "SCN-DEMO-001" has the rows "alpha", "beta" and "a\|b" of the column "word"
    And its system test prints the word of its row, expects an empty "$OUTPUT", writes a file there and expects the CLI to print the word
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And the output has the words "alpha", "beta" and "a|b" that the test printed
    And "report.xml" has one test case, the passed "SCN-DEMO-001"

  @id=SCN-TK-202 @status=implemented
  Scenario: One failed row fails the test case of the Outline and the failure names the row
    Given a module whose Outline "SCN-DEMO-001" has the rows "alpha", "beta" and "gamma", and the row "beta" expects the output "BETA"
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 1
    And "report.xml" has the failed test case "SCN-DEMO-001"
    And the output says "1 of 3 examples of SCN-DEMO-001 failed" and names "example 2 (word=beta, output=BETA)" and the failed step 'Then "the output is BETA"'
    And the output has the word "gamma" that the test printed after the failed row

  @id=SCN-TK-203 @status=implemented
  Scenario: A planned Outline whose rows all pass fails
    Given a module whose planned Outline "SCN-DEMO-001" has the rows "alpha" and "beta" and a test that passes for both
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 1
    And the output contains "SCN-DEMO-001 is planned but its test passes: set @status=implemented."
