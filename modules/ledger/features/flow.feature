@module=ledger @owner=maintainers
Feature: Flow metrics
  "ledger report" shows how work flows through the factory: throughput, cycle time by segment, human interactions,
  runs by agent type and the revert rate, from run records and pull request events.

  @id=SCN-LEDGER-020 @status=implemented @realizes=SCN-FACTORY-METRIC-001
  Scenario: The report shows human interactions per pull request and their trend per day
    Given a pull request opened on 2026-01-05 with 3 reviews by people and 1 by a bot
    And a pull request opened on 2026-01-06 with 1 comment by a person
    When the user runs "ledger report data.jsonl"
    Then "report.json" shows 2 human interactions per pull request
    And the human interactions per pull request 3 on "2026-01-05" and 1 on "2026-01-06"

  @id=SCN-LEDGER-021 @status=implemented @realizes=SCN-FACTORY-METRIC-002
  Scenario: The report shows the median cycle time by segment
    Given a pull request whose work item was received at 08:00, opened at 09:00, first reviewed by a person at 11:00 and merged at 12:00
    And a pull request whose work item was received at 08:00, opened at 10:00, first reviewed by a person at 14:00 and merged at 16:00
    When the user runs "ledger report data.jsonl"
    Then "report.json" shows the median hours from kickoff to pull request 1.5, from kickoff to merge 6, from pull request to first human review 3 and from first human review to merge 1.5

  @id=SCN-LEDGER-022 @status=implemented
  Scenario: Without a work item event the kickoff is the start of the pull request's first run
    Given a pull request opened at 10:00 whose runs started at 09:30 and at 07:00, without a "work.received@v1" event
    When the user runs "ledger report data.jsonl"
    Then "report.json" shows the median hours from kickoff to pull request 3

  @id=SCN-LEDGER-023 @status=implemented
  Scenario: A review by an agent or a bot is not a human review
    Given a pull request opened at 09:00, reviewed by a bot at 09:30 and by a person at 13:00
    When the user runs "ledger report data.jsonl"
    Then "report.json" shows the median hours from pull request to first human review 4

  @id=SCN-LEDGER-024 @status=implemented @realizes=SCN-FACTORY-METRIC-003
  Scenario: The report shows pull requests opened and merged per day
    Given 2 pull requests opened on 2026-01-05, one of them merged on 2026-01-06, and 1 opened on 2026-01-06
    When the user runs "ledger report data.jsonl"
    Then "report.json" shows on "2026-01-05" 2 opened and 0 merged, and on "2026-01-06" 1 opened and 1 merged

  @id=SCN-LEDGER-025 @status=implemented @realizes=SCN-FACTORY-METRIC-003
  Scenario: The report shows total and top-level runs by agent type
    Given a run of the agent "implementer" that started a run of the agent "reviewer" in its trace, and a run of the harness "codex" without an agent name
    When the user runs "ledger report data.jsonl"
    Then "report.json" shows 3 runs, 2 of them top-level
    And by agent "implementer" 1 run and 1 top-level, "reviewer" 1 run and 0 top-level, "codex" 1 run and 1 top-level

  @id=SCN-LEDGER-026 @status=implemented @realizes=SCN-FACTORY-METRIC-008
  Scenario: The revert rate is shown next to throughput and cost
    Given 4 merged pull requests, one of them titled 'Revert "Add the checkout page"'
    When the user runs "ledger report data.jsonl"
    Then "report.json" shows the revert rate 0.25 with 1 revert of 4 merged pull requests
    And the output says "revert rate 25.0%"

  @id=SCN-LEDGER-027 @status=implemented @realizes=SCN-FACTORY-OUTCOME-002
  Scenario: The options "--since" and "--until" limit the period
    Given a pull request opened on 2026-01-04 with spend rows of 5.00 USD on that day
    And a pull request opened on 2026-01-05 with spend rows of 2.00 USD on that day
    When the user runs "ledger report --since 2026-01-05 --until 2026-01-05 data.jsonl"
    Then "report.json" shows the period from "2026-01-05" to "2026-01-05", 1 pull request and a total spend of 2.00 USD

  @id=SCN-LEDGER-028 @status=implemented @realizes=SCN-FACTORY-OUTCOME-001
  Scenario: The report is written as Markdown with throughput, cycle time, cost and revert rate
    Given 326 pull requests opened in the period and spend rows of 5351.38 USD in total
    When the user runs "ledger report --markdown report.md data.jsonl"
    Then "report.md" has the row "| Cost per pull request | 16.42 USD |"
    And "report.md" has the sections "Throughput", "Cycle time", "Cost", "Spend" and "Revert rate"

  @id=SCN-LEDGER-029 @status=implemented
  Scenario: Without pull requests the cost per pull request is empty
    Given spend rows of 2.00 USD and no pull request events
    When the user runs "ledger report data.jsonl"
    Then the command exits with code 0
    And "report.json" shows a total spend of 2.00 USD and the cost per pull request null
