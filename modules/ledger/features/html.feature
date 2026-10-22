@module=ledger @owner=maintainers
Feature: Dashboard page
  "ledger report --html" also writes the report as one HTML page that needs no server, no database and no
  network: a dashboard to publish on any static host.

  @id=SCN-LEDGER-057 @status=implemented @realizes=SCN-FACTORY-METRIC-004
  Scenario: The page shows the cost per pull request and its split
    Given 2 pull requests, spend rows of 10.00 USD in total and runs of 4 hours in total
    When the user runs "ledger report --compute-usd-per-hour 0.50 --platform-usd 6 --html ledger.html data.jsonl"
    Then the command exits with code 0
    And the output says "wrote" and the path of "ledger.html"
    And "ledger.html" shows "Cost per pull request 9.00 USD"
    And "ledger.html" shows "Inference 5.00 USD", "Compute 1.00 USD" and "Platform 3.00 USD"

  @id=SCN-LEDGER-058 @status=implemented @realizes=SCN-FACTORY-METRIC-003 @realizes=SCN-FACTORY-METRIC-008
  Scenario: The page shows the revert rate next to throughput and runs
    Given 2 merged pull requests, one of them titled 'Revert "Change 1"', and 3 runs of which 1 runs below another
    When the user runs "ledger report --html ledger.html data.jsonl"
    Then "ledger.html" shows "Pull requests merged 2", "Runs 3", "Top-level runs 2" and "Revert rate 50.0%"

  @id=SCN-LEDGER-059 @status=implemented @realizes=SCN-FACTORY-METRIC-003
  Scenario: The page charts pull requests opened and merged per day
    Given 2 pull requests opened on 2026-01-05 and one of them merged on 2026-01-05
    When the user runs "ledger report --html ledger.html data.jsonl"
    Then "ledger.html" has a bar for "2026-01-05: 2 opened, 1 merged"

  @id=SCN-LEDGER-060 @status=implemented @realizes=SCN-FACTORY-METRIC-006
  Scenario: The page links the most expensive pull requests
    Given 25 pull requests whose runs cost 1 USD to 25 USD
    When the user runs "ledger report --html ledger.html data.jsonl"
    Then "ledger.html" links "https://github.com/acme/web/pull/25" with the text "Change 25" and shows "25.00 USD"
    And "ledger.html" links 20 pull requests

  @id=SCN-LEDGER-061 @status=implemented
  Scenario: A pull request title is shown as text, never as markup
    Given the pull request "https://github.com/acme/web/pull/1" titled "<script>alert(1)</script>" whose run cost 1 USD
    When the user runs "ledger report --html ledger.html data.jsonl"
    Then "ledger.html" contains "&lt;script&gt;alert(1)&lt;/script&gt;"
    And "ledger.html" has no "<script" element

  @id=SCN-LEDGER-062 @status=implemented @realizes=SCN-FACTORY-METRIC-005
  Scenario: The page shows the spend by source, user, agent and model
    Given a run with the source "slack", the requester "github:mona", the agent "implementer" and the model "claude-sonnet-5-5" and spend rows of 3.00 USD
    And a spend row of 1.00 USD of the model "claude-haiku-5-5" without a run
    When the user runs "ledger report --html ledger.html data.jsonl"
    Then "ledger.html" shows "Unattributed 1.00 USD"
    And "ledger.html" shows "slack 3.00 USD 75.0%", "github:mona 3.00 USD 75.0%", "implementer 3.00 USD 75.0%" and "claude-sonnet-5-5 3.00 USD 75.0%"

  @id=SCN-LEDGER-063 @status=implemented @realizes=SCN-FACTORY-METRIC-001 @realizes=SCN-FACTORY-METRIC-002
  Scenario: The page shows the median cycle time by segment and the human interactions
    Given a pull request whose work item was received at 09:00, opened at 10:00, first reviewed by a person at 12:00 and merged at 13:00
    When the user runs "ledger report --html ledger.html data.jsonl"
    Then "ledger.html" shows "Kickoff to pull request 1 h", "Kickoff to merge 4 h", "Pull request to first human review 2 h" and "First human review to merge 1 h"
    And "ledger.html" shows "Human interactions per pull request 1"
