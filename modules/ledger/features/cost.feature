@module=ledger @owner=maintainers
Feature: Cost per pull request
  "ledger report" divides the period's cost by the pull requests opened in it, splits it into compute, platform and
  inference, slices the spend and lists the most expensive pull requests.

  @id=SCN-LEDGER-010 @status=implemented @realizes=SCN-FACTORY-METRIC-004
  Scenario: The cost per pull request is the total spend divided by the pull requests
    Given 326 pull requests opened in the period and spend rows of 5351.38 USD in total
    When the user runs "ledger report data.jsonl"
    Then the command exits with code 0
    And "report.json" shows a cost per pull request of 16.42 USD
    And the output says "326 pull requests, cost per pull request 16.42 USD"

  @id=SCN-LEDGER-011 @status=implemented @realizes=SCN-FACTORY-METRIC-004
  Scenario: The cost per pull request is split into compute, platform and inference
    Given 2 pull requests, spend rows of 10.00 USD in total and runs of 4 hours in total
    When the user runs "ledger report --compute-usd-per-hour 0.50 --platform-usd 6 data.jsonl"
    Then "report.json" shows a cost per pull request of 9.00 USD split into inference 5.00, compute 1.00 and platform 3.00

  @id=SCN-LEDGER-012 @status=implemented @realizes=SCN-FACTORY-METRIC-005
  Scenario: Spend is sliced by source, user, agent and model
    Given a run with the source "slack", the requester "github:mona", the agent "implementer" and the model "claude-sonnet-5-5" and spend rows of 3.00 USD
    And a run with the source "github", the requester "github:hubot", the agent "reviewer" and the model "claude-haiku-5-5" and spend rows of 1.00 USD
    When the user runs "ledger report data.jsonl"
    Then "report.json" shows the spend by "source" as "slack" 3.00 USD with the share 0.75 and "github" 1.00 USD with the share 0.25
    And "report.json" shows the spend by "user" as "github:mona" 3.00 USD with the share 0.75 and "github:hubot" 1.00 USD with the share 0.25
    And "report.json" shows the spend by "agent" as "implementer" 3.00 USD with the share 0.75 and "reviewer" 1.00 USD with the share 0.25
    And "report.json" shows the spend by "model" as "claude-sonnet-5-5" 3.00 USD with the share 0.75 and "claude-haiku-5-5" 1.00 USD with the share 0.25

  @id=SCN-LEDGER-013 @status=implemented @realizes=SCN-FACTORY-METRIC-005
  Scenario: Spend without a run is reported as unattributed
    Given a spend row of 2.00 USD for the run "run-01" and a spend row of 0.50 USD without a run
    When the user runs "ledger report data.jsonl"
    Then "report.json" shows the unattributed spend 0.50 USD
    And the spend by "source" lists "unattributed" with 0.50 USD and the share 0.2

  @id=SCN-LEDGER-014 @status=implemented
  Scenario: A run without spend rows counts its own cost
    Given the run "run-01" with the cost 1.25 USD and no spend rows
    When the user runs "ledger report data.jsonl"
    Then "report.json" shows a total spend of 1.25 USD

  @id=SCN-LEDGER-015 @status=implemented
  Scenario: Spend rows of a run replace the run's own cost
    Given the run "run-01" with the cost 1.25 USD and spend rows of 2.00 USD for "run-01"
    When the user runs "ledger report data.jsonl"
    Then "report.json" shows a total spend of 2.00 USD

  @id=SCN-LEDGER-016 @status=implemented @realizes=SCN-FACTORY-METRIC-006
  Scenario: The 20 most expensive pull requests are listed
    Given 25 pull requests whose runs cost 1 USD to 25 USD
    When the user runs "ledger report data.jsonl"
    Then "report.json" lists 20 pull requests by cost, from 25.00 USD down to 6.00 USD, each with its URL and title

  @id=SCN-LEDGER-017 @status=implemented
  Scenario: A run that belongs to two pull requests splits its cost evenly
    Given the run "run-01" with spend rows of 3.00 USD that lists the pull requests "https://github.com/acme/web/pull/1" and "https://github.com/acme/web/pull/2"
    When the user runs "ledger report data.jsonl"
    Then "report.json" lists both pull requests with the cost 1.50 USD

  @id=SCN-LEDGER-018 @status=implemented
  Scenario: A run belongs to the pull request of its work item
    Given the run "run-01" of the work item "work-01" with spend rows of 4.00 USD and no pull request
    And a "pr.opened@v1" event for "https://github.com/acme/web/pull/7" of the work item "work-01"
    When the user runs "ledger report data.jsonl"
    Then "report.json" lists "https://github.com/acme/web/pull/7" with the cost 4.00 USD

  @id=SCN-LEDGER-019 @status=implemented @realizes=SCN-FACTORY-METRIC-007
  Scenario: The report shows the gap to a cost target
    Given 326 pull requests opened in the period and spend rows of 5351.38 USD in total
    When the user runs "ledger report --target 15 data.jsonl"
    Then "report.json" shows the target 15.00 USD and the gap 1.42 USD

  @id=SCN-LEDGER-056 @status=implemented
  Scenario: A run's cost splits only over the pull requests in the ledger
    Given the run "run-01" with spend rows of 3.00 USD that lists the pull requests "https://github.com/acme/web/pull/1" and "https://github.com/other/app/pull/9"
    And a "pr.opened@v1" event for "https://github.com/acme/web/pull/1" and none for "https://github.com/other/app/pull/9"
    When the user runs "ledger report data.jsonl"
    Then "report.json" lists "https://github.com/acme/web/pull/1" with the cost 3.00 USD
