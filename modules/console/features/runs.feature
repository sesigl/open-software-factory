@module=console @owner=maintainers
Feature: The runs page
  The page "/" lists the runs of every foreman in "CONSOLE_FOREMAN_URL" and filters them by state (ADR 0072).

  @id=SCN-CONSOLE-005 @status=planned @realizes=SCN-FACTORY-VIS-001
  Scenario: A run's row shows its title, source, requester, pull request and age
    Given a foreman with the run "Export reports as CSV" from "slack", asked by "Varun", started at "2025-12-31T23:55:00Z" with the pull request "https://github.com/acme/web/pull/7"
    When a person opens "/" at "2026-01-01T00:00:00Z"
    Then the run's row shows "Export reports as CSV", "slack", "Varun" and the age "5 min"
    And the row links the pull request "https://github.com/acme/web/pull/7"
    And the row links the run's page "/runs/run_5d41402abc4b2a76b971"

  @id=SCN-CONSOLE-006 @status=planned @realizes=SCN-FACTORY-VIS-001
  Scenario: The runs page lists the runs of two factories
    Given a foreman of the factory "web" with 7 running runs and a foreman of the factory "mobile" with 5 running runs
    When a person opens "/"
    Then the page lists 12 runs
    And 7 rows name the factory "web" and 5 rows name the factory "mobile"

  @id=SCN-CONSOLE-007 @status=planned
  Scenario: Runs that have not ended come first, the newest first
    Given a foreman with the run "Fix login" that ended at "2025-12-31T23:00:00Z", the run "Add search" started at "2025-12-31T22:00:00Z" and the run "Export reports as CSV" started at "2025-12-31T23:30:00Z"
    When a person opens "/"
    Then the rows are "Export reports as CSV", "Add search" and "Fix login" in this order

  @id=SCN-CONSOLE-008 @status=planned @realizes=SCN-FACTORY-ORCH-008
  Scenario: A person filters the runs by the state "failed"
    Given a foreman whose API answers "/v1/runs?state=failed" with the run "Fix login"
    When a person opens "/?state=failed"
    Then the page lists only the run "Fix login" in the state "failed"
    And the console asked the foreman for "/v1/runs?state=failed"

  @id=SCN-CONSOLE-009 @status=planned @realizes=SCN-FACTORY-ORCH-008
  Scenario: The runs page links a filter for each of the five states
    Given a foreman with no runs
    When a person opens "/"
    Then the page links "?state=running", "?state=blocked", "?state=complete", "?state=failed" and "?state=cancelled"

  @id=SCN-CONSOLE-010 @status=planned
  Scenario: An unknown state answers 400 and names the five states
    Given a foreman with no runs
    When a person opens "/?state=merged"
    Then the page answers 400 and says "no state merged: running, blocked, complete, failed or cancelled"
    And the console did not ask the foreman

  @id=SCN-CONSOLE-011 @status=planned
  Scenario: A foreman that does not answer is named, and the other foreman's runs are listed
    Given a foreman of the factory "web" with the run "Export reports as CSV" and a second foreman that answers 503
    When a person opens "/"
    Then the page answers 200 and lists the run "Export reports as CSV"
    And the page says "the foreman at <second URL> did not answer: 503"

  @id=SCN-CONSOLE-012 @status=planned @realizes=SCN-FACTORY-VIS-001
  Scenario: The runs page reloads itself every 10 seconds
    Given a foreman with no runs
    When a person opens "/"
    Then the page asks the browser to reload it after 10 seconds

  @id=SCN-CONSOLE-013 @status=planned
  Scenario: The console calls each foreman with its token
    Given a foreman with no runs and "CONSOLE_FOREMAN_TOKEN" set to "foreman-token-1"
    When a person opens "/"
    Then the foreman received "/v1/runs" with "Authorization: Bearer foreman-token-1"

  @id=SCN-CONSOLE-014 @status=planned
  Scenario: A title with HTML is shown as text
    Given a foreman with the run "<script>alert(1)</script>"
    When a person opens "/"
    Then the page shows the text "<script>alert(1)</script>"
    And the page has no script element
