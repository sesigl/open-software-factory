@module=console @owner=maintainers
Feature: The self-improvement inbox
  The page "/inbox" lists observer's proposals: the open pull requests of "CONSOLE_INBOX_REPOSITORY" whose branch starts
  with "observer/", with their age and review state. The console asks the forge port's adapter in
  "CONSOLE_FORGE_ADAPTER" with "prs" when the page is opened (ADR 0073). The test forge is the testkit's fake GitHub
  with the repository "tester/web", and the adapter is forge-github.

  @id=SCN-CONSOLE-030 @status=planned @realizes=SCN-FACTORY-IMPROVE-004
  Scenario: The inbox lists observer's open pull requests, the newest first
    Given the forge's repository "tester/web" with open pull requests from "observer/triage-inline-1a2b3c4d" titled "Triage asks before it investigates", from "fix-checkout" titled "Fix checkout button on Safari" and from "observer/review-scope-5e6f7a8b" titled "Review reads the scenario first", in this order
    When a person opens "/inbox"
    Then the rows are "Review reads the scenario first" and "Triage asks before it investigates" in this order
    And each row links its pull request
    And the page's navigation links "/inbox"

  @id=SCN-CONSOLE-031 @status=planned @realizes=SCN-FACTORY-IMPROVE-004
  Scenario: A proposal shows its age and the state "needs review" or "approved"
    Given the forge's repository "tester/web" with the proposal "Triage asks before it investigates" that the person "reviewer" approved and the proposal "Review reads the scenario first" that nobody reviewed, both opened on "2026-01-01"
    When a person opens "/inbox" at "2026-01-03T12:00:00Z"
    Then the row of "Triage asks before it investigates" shows "approved" and the age "2 d"
    And the row of "Review reads the scenario first" shows "needs review" and the age "2 d"

  @id=SCN-CONSOLE-032 @status=planned
  Scenario: A proposal a reviewer asked to change shows "changes requested"
    Given the forge's repository "tester/web" with the proposal "Triage asks before it investigates" on which the person "reviewer" asked for changes
    When a person opens "/inbox"
    Then the row of "Triage asks before it investigates" shows "changes requested"

  @id=SCN-CONSOLE-033 @status=planned
  Scenario: The inbox lists the branches of the prefix in "CONSOLE_INBOX_PREFIX"
    Given the forge's repository "tester/web" with open pull requests from "improve/triage-1a2b3c4d" titled "Triage asks before it investigates" and from "observer/review-scope-5e6f7a8b" titled "Review reads the scenario first"
    When a person opens "/inbox" with "CONSOLE_INBOX_PREFIX" set to "improve/"
    Then the rows are only "Triage asks before it investigates"

  @id=SCN-CONSOLE-034 @status=planned
  Scenario: A forge that refuses the token is named on the inbox
    Given the forge's repository "tester/web" and the console's forge token "not-a-token"
    When a person opens "/inbox"
    Then the page answers 200 and says "the forge did not answer: the forge refused the token"

  @id=SCN-CONSOLE-035 @status=planned
  Scenario: Without a repository the inbox answers 404 and names the variable
    Given a console without "CONSOLE_INBOX_REPOSITORY"
    When a person opens "/inbox"
    Then the page answers 404 and says "no inbox: set CONSOLE_INBOX_REPOSITORY to the repository of observer's pull requests"
    And the page's navigation does not link "/inbox"
