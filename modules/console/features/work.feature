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

  @id=SCN-CONSOLE-045 @status=implemented
  Scenario: A signed-in person submits work from the work page
    Given a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and an intake that takes submissions
    When the person "ada@acme.dev" sends the form "submit work" of "/work" with the title "Add a dark mode" and the type "idea"
    Then the answer redirects to "/work"
    And intake received the submission "Add a dark mode" of the type "idea" from the person "ada@acme.dev" with the origin "console"

  @id=SCN-CONSOLE-046 @status=implemented
  Scenario: A form without the signed-in person submits nothing
    Given a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and an intake that takes submissions
    When a program sends the form "submit work" of "/work" without the header "X-Forwarded-Email"
    Then the answer has the status 401 and says "sign in first: the console needs x-forwarded-email"
    And intake received no submission

  @id=SCN-CONSOLE-047 @status=implemented
  Scenario: Without "CONSOLE_USER_HEADER" the console stays read-only
    Given a console with an intake but without "CONSOLE_USER_HEADER"
    When a person opens "/work" and a program sends the form "submit work" of "/work"
    Then the page has no form
    And the form gets the status 405
