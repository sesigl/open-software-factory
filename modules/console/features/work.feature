@module=console @owner=maintainers
Feature: Work
  The page "/work" shows intake's latest work items, also the ones that wait without a run.

  @id=SCN-CONSOLE-043 @status=implemented
  Scenario: The work page lists each work item with its status and its run
    Given an intake whose inbox holds "Import reports from CSV", received and without a run, and "Export reports as CSV", running in the run "run_5d41402abc4b2a76b971"
    When a person opens "/work"
    Then the table has the rows "Import reports from CSV", "task", "received", "slack", "Varun", "—" and "Export reports as CSV", "task", "running", "slack", "Varun", "run_5d41402abc4b2a76b971"
    And the run links "/runs/run_5d41402abc4b2a76b971"
    And the page's navigation links "/work"

  @id=SCN-CONSOLE-044 @status=implemented
  Scenario: Without intake the work page answers 404 and names the variable
    Given a console without "CONSOLE_INTAKE_URL"
    When a person opens "/work"
    Then the page answers 404 and says "no work items: set CONSOLE_INTAKE_URL to the base URL of intake's API"
