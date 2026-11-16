@module=ui @owner=maintainers
Feature: The island "work-list"
  The first island (ADR 0152): the table of work items that the server rendered, kept fresh in the browser without a
  reload of the page. Every `interval` milliseconds it loads its route, a JSON answer of rows that the server made
  ready to show, and shows them in the server's markup. While the route fails it keeps the rows it had and says so.
  Each scenario opens a page of the workbench, served with the console's Content-Security-Policy, in Chromium, with the
  browser's clock paused: only the scenario moves it.

  @id=SCN-UI-003 @status=implemented
  Scenario: The island shows the rows its route answers once the interval has passed, and not before
    Given the workbench is served with the console's Content-Security-Policy
    When a person opens "/work-list/rows/", whose route answers "Add a dark mode" and "Import reports from CSV" every 10 seconds
    Then the list shows the one row that the server rendered, "Import reports from CSV" with its link, its status and its age
    And 9,999 milliseconds later it still shows only that row
    And 10 seconds later it shows "Add a dark mode" with the status "running" and the run "run-7" linked to "/runs/run-7", above "Import reports from CSV"

  @id=SCN-UI-004 @status=implemented
  Scenario: The island shows the empty text when its route answers no work item
    Given the workbench is served with the console's Content-Security-Policy
    When a person opens "/work-list/empty/", whose route answers no work item every 10 seconds
    Then the list shows "Import reports from CSV" and no empty text
    And 10 seconds later it shows "No work items yet. Work arrives from the factory's sources and from this form." and no row

  @id=SCN-UI-005 @status=implemented
  Scenario: The island keeps its rows and says so while its route fails
    Given the workbench is served with the console's Content-Security-Policy
    When a person opens "/work-list/failing/", whose route answers no list
    Then the list shows "Import reports from CSV" and no alert
    And 10 seconds later it still shows "Import reports from CSV", and the alert "The list could not be refreshed: it shows the work items as they were."

  @id=SCN-UI-009 @status=implemented
  Scenario: The island keeps its rows and says so when its route answers a page instead of JSON, like a sign-in page
    Given the workbench is served with the console's Content-Security-Policy
    When a person opens "/work-list/signed-out/", whose route answers an HTML page
    Then 10 seconds later the list still shows "Import reports from CSV", and the alert "The list could not be refreshed: it shows the work items as they were."

  @id=SCN-UI-006 @status=implemented
  Scenario: The island with the interval 0 never loads its route
    Given the workbench is served with the console's Content-Security-Policy
    When a person opens "/work-list/off/", whose route answers a new work item, with the interval 0
    Then a minute later the list still shows only "Import reports from CSV"

  @id=SCN-UI-007 @status=implemented
  Scenario: The text typed into a field beside the island stays while the list refreshes
    Given the workbench is served with the console's Content-Security-Policy
    When a person opens "/work-list/rows/" and types "Add a dark mode" into the field "Title"
    Then 10 seconds later the list shows "Add a dark mode" and the field "Title" still holds "Add a dark mode"
    And the page passes the accessibility checks

  @id=SCN-UI-008 @status=implemented
  Scenario: Every page of the workbench loads its script from its own files, never from an inline script
    Given the workbench is served with the console's Content-Security-Policy
    When a person loads each of its pages "/work-list/rows/", "/work-list/empty/", "/work-list/failing/", "/work-list/signed-out/" and "/work-list/off/"
    Then each page has one script, a module script of the site's own "/_astro/" folder, and no inline script
