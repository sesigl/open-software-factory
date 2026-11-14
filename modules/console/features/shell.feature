@module=console @owner=maintainers
Feature: The shell of the pages in the new look
  The runs page "/" and every page in the look of the design system have the same shell (ADR 0133): the navigation
  with only the pages that work in this console, the factory's name, the account and a link to the other theme. On a
  phone the navigation folds away. The pages in the old look stay reachable as "Classic pages".

  @id=SCN-CONSOLE-158 @status=implemented
  Scenario: The navigation of a console without intake, an inbox or cost and scores links only the pages that work
    Given a console without "CONSOLE_INTAKE_URL", "CONSOLE_INBOX_REPOSITORY" and "CONSOLE_IMPROVE_DIR"
    When a person opens "/"
    Then the navigation links "Runs" as the current page and the classic pages "Factory" and "Health"

  @id=SCN-CONSOLE-159 @status=implemented
  Scenario: The navigation of a console with intake, an inbox and cost and scores links their pages too
    Given a console with "CONSOLE_INTAKE_URL", "CONSOLE_INBOX_REPOSITORY" and "CONSOLE_IMPROVE_DIR" and the factory "acme"
    When a person opens "/"
    Then the navigation links "Runs" and the classic pages "Work", "Factory", "Inbox", "Cost and scores" and "Health"
    And the shell names the factory "acme"
    And the page offers "Submit work" as its main action

  @id=SCN-CONSOLE-160 @status=implemented @realizes=SCN-FACTORY-VIS-001
  Scenario: The link "Runs" counts the runs that wait for a person
    Given a foreman with the run "Approve the spec" that waits for a person and the running run "Export reports as CSV"
    When a person opens "/", "/?state=blocked" and "/?state=running"
    Then the link "Runs" says "1 waits" on "/" and on "/?state=blocked"
    And it says no count on "/?state=running", which does not show the runs that wait

  @id=SCN-CONSOLE-161 @status=implemented
  Scenario: A person switches to the light theme and back, and stays on the page
    Given a foreman with no runs
    When a person opens "/?state=failed" and follows "Light theme"
    Then the page "/?state=failed" has the light theme and links "Dark theme"
    And after "Dark theme" the page has the dark theme again

  @id=SCN-CONSOLE-162 @status=implemented
  Scenario: The shell has a skip link to the content and its landmarks
    Given a foreman with no runs
    When a person opens "/"
    Then the page's first link is "Skip to the content", to "#content"
    And the page has the banner, the navigation "Main", the region "Account" and the main content "#content"
