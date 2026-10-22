@module=spec-files @owner=maintainers
Feature: Feature files
  parseFeature reads a feature file into its scenarios, with their IDs, statuses, tags and steps.

  @id=SCN-SPECFILES-001 @status=implemented
  Scenario: parseFeature gives each scenario with its IDs, status, inherited tags and steps
    Given the feature file "a.feature" with the feature tag "@module=demo", a Background step "* a repository", and in a Rule tagged "@slow" the scenario "Steps" tagged "@id=SCN-DEMO-001 @status=implemented" with the steps "When the user runs it", "And it ends", "Then it passes" and "Given the next run"
    When the module parses the feature file
    Then it gets one scenario "Steps" in "a.feature" with the ID "SCN-DEMO-001" and the status "implemented"
    And its tags are "@module=demo", "@slow", "@id=SCN-DEMO-001" and "@status=implemented"
    And its steps are "Given a repository", "When the user runs it", "When it ends", "Then it passes" and "Given the next run", with their lines

  @id=SCN-SPECFILES-002 @status=implemented
  Scenario: parseFeature counts the rows of all Examples tables
    Given the feature file "a.feature" with a Scenario Outline whose two Examples tables have 2 and 3 rows
    When the module parses the feature file
    Then the scenario has 5 examples

  @id=SCN-SPECFILES-003 @status=implemented
  Scenario: parseFeature reports a feature file that does not parse
    Given the feature file "broken.feature" whose line 12 is "Scenario without a colon" after 10 spaces
    When the module parses the feature file
    Then it gets no scenarios and the error "Gherkin does not parse" in "broken.feature" at line 12

  @id=SCN-SPECFILES-012 @status=implemented
  Scenario: parseFeature gives nothing for an empty file
    Given the feature file "empty.feature" without any text
    When the module parses the feature file
    Then it gets no scenarios and no errors

  @id=SCN-SPECFILES-004 @status=implemented
  Scenario: statusOf gives the status only for exactly one status tag
    Given a scenario tagged "@status=planned" and a scenario tagged "@status=planned @status=implemented"
    When the module asks for the status of each
    Then it gets "planned" for the first and no status for the second
