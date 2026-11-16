@module=ledger @owner=maintainers
Feature: Flow metrics
  "ledger report" shows how work flows through the factory: throughput, cycle time by segment, human interactions,
  runs by agent type, the revert rate and the factory's share of merged pull requests, from run records and pull
  request events.

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

  @id=SCN-LEDGER-067 @status=implemented
  Scenario: The report shows the factory's share of merged pull requests and the revert rate of each group
    Given merged pull requests from the head branches "osf/run-01", "observer/tune-skill-1a2b3c4d", "factory/12-add-cart", "fix-login" and "add-sum"
    And a merged pull request 'Revert "Add the sum"' from the head branch "revert-5-add-sum" that reverts the one from "add-sum"
    When the user runs "ledger report data.jsonl"
    Then "report.json" shows 3 merged pull requests of the factory and 3 of people, each a share of 0.5
    And "report.json" shows the revert rate 0 for the factory and 0.3333 for people
    And the output says "merged pull requests 6, factory share 50.0%, revert rate of the factory 0.0% and of people 33.3%"

  @id=SCN-LEDGER-068 @status=implemented
  Scenario: A revert counts for the group of the pull request it reverts
    Given a merged pull request "Add the cart" from the head branch "osf/run-07"
    And a merged pull request 'Revert "Add the cart"' from the head branch "revert-1-osf/run-07"
    When the user runs "ledger report data.jsonl"
    Then "report.json" shows the revert rate 1 for the factory with 1 revert of 1 merged pull request
    And "report.json" shows the revert rate 0 for people with 0 reverts of 1 merged pull request

  @id=SCN-LEDGER-069 @status=implemented
  Scenario: A group without merged pull requests in the period shows no revert rate
    Given a pull request from the head branch "osf/run-01" merged on 2026-01-04
    And a pull request from the head branch "fix-login" merged on 2026-01-05
    When the user runs "ledger report --since 2026-01-05 --until 2026-01-05 --markdown report.md data.jsonl"
    Then "report.json" shows 0 merged pull requests of the factory, a share of 0 and the revert rate null
    And "report.md" has under "## Factory and people" the table "Origin | Merged | Share | Reverts | Revert rate" with the rows "Factory | 0 | 0.0% | 0 | -" and "People | 1 | 100.0% | 0 | 0.0%"

  @id=SCN-LEDGER-070 @status=implemented
  Scenario: The option "--factory-branches" names the head branch prefixes of the factory's pull requests
    Given merged pull requests from the head branches "bot/run-1", "ci/bump-2", "osf/run-3" and "fix-login"
    When the user runs "ledger report --factory-branches 'bot/, ci/,' data.jsonl"
    Then "report.json" shows the factory branches "bot/" and "ci/", 2 merged pull requests of the factory and 2 of people

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

  @id=SCN-LEDGER-065 @status=implemented @realizes=SCN-FACTORY-OUTCOME-001
  Scenario: The Markdown report shows each measure of the period in its table
    Given a pull request "Add the login" opened on 2026-01-05 at 09:00 for a work item received at 08:00, reviewed by a person at 11:00 and merged on 2026-01-06 at 12:00
    And a run of 2 hours of the agent "implementer" from the source "slack" for that pull request, with spend rows of 4.00 USD
    When the user runs "ledger report --since 2026-01-05 --until 2026-01-06 --target 3 --compute-usd-per-hour 0.50 --platform-usd 1 --markdown report.md data.jsonl"
    Then "report.md" has the title "# Ledger report: 2026-01-05 to 2026-01-06"
    And "report.md" has the table "Measure | Value" with the rows "Pull requests opened | 1", "Pull requests merged | 1", "Human interactions per pull request | 1", "Runs | 1" and "Top-level runs | 1"
    And "report.md" has the table "Day | Opened | Merged" with the rows "2026-01-05 | 1 | 0" and "2026-01-06 | 0 | 1"
    And "report.md" has the table "Segment | Median" with the rows "Kickoff to pull request | 1 h", "Kickoff to merge | 28 h", "Pull request to first human review | 2 h" and "First human review to merge | 25 h"
    And "report.md" has the table "Measure | Value" with the rows "Cost per pull request | 6.00 USD", "Inference per pull request | 4.00 USD", "Compute per pull request | 1.00 USD", "Platform per pull request | 1.00 USD", "Target | 3.00 USD" and "Gap to target | 3.00 USD"
    And "report.md" has the table "Pull request | Title | Cost" with the row "https://github.com/acme/web/pull/1 | Add the login | 5.00 USD"
    And "report.md" has the table "Measure | Value" with the rows "Total | 4.00 USD" and "Unattributed | 0.00 USD"
    And "report.md" has under "### By source" the table "source | Spend | Share" with the row "slack | 4.00 USD | 100.0%"
    And "report.md" has under "### By user" the table "user | Spend | Share" with the row "github:mona | 4.00 USD | 100.0%"
    And "report.md" has under "### By agent" the table "agent | Spend | Share" with the row "implementer | 4.00 USD | 100.0%"
    And "report.md" has under "### By model" the table "model | Spend | Share" with the row "claude-sonnet-5-5 | 4.00 USD | 100.0%"
    And "report.md" has the table "Reverts | Merged | Rate" with the row "0 | 1 | 0.0%"

  @id=SCN-LEDGER-066 @status=implemented
  Scenario: Without pull requests the Markdown report shows a dash for each value it cannot compute
    Given spend rows of 2.00 USD and no pull request events
    When the user runs "ledger report --markdown report.md data.jsonl"
    Then "report.md" has the title "# Ledger report: start to end"
    And "report.md" has the table "Measure | Value" with the rows "Pull requests opened | 0", "Pull requests merged | 0", "Human interactions per pull request | -", "Runs | 0" and "Top-level runs | 0"
    And "report.md" has the table "Segment | Median" with the rows "Kickoff to pull request | -", "Kickoff to merge | -", "Pull request to first human review | -" and "First human review to merge | -"
    And "report.md" has the table "Measure | Value" with the rows "Cost per pull request | -", "Inference per pull request | -", "Compute per pull request | -", "Platform per pull request | -", "Target | -" and "Gap to target | -"
    And "report.md" has the table "Reverts | Merged | Rate" with the row "0 | 0 | -"
