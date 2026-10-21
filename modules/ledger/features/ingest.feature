@module=ledger @owner=maintainers
Feature: Ingest spend, runs and forge events
  "ledger ingest" reads LiteLLM spend log rows, run records and CloudEvents from files and folders into a DuckDB
  database file. Ingesting the same records again replaces them.

  @id=SCN-LEDGER-003 @status=planned
  Scenario: Ingest counts the runs, spend rows and events it read
    Given the file "data.jsonl" with 2 runs, 3 spend rows and 4 pull request events
    When the user runs "ledger ingest data.jsonl"
    Then the command exits with code 0
    And the output says "ingested 2 runs, 3 spend rows and 4 events into ledger.duckdb"

  @id=SCN-LEDGER-004 @status=planned
  Scenario: Ingesting the same file twice counts each record once
    Given the file "data.jsonl" with the pull request "https://github.com/acme/web/pull/1" and spend rows of 2.50 USD in total
    When the user runs "ledger ingest data.jsonl" twice and then "ledger report"
    Then "report.json" shows 1 pull request and a total spend of 2.50 USD

  @id=SCN-LEDGER-005 @status=planned
  Scenario: A folder is read with every JSON and JSON Lines file below it
    Given the folder "exports" with the file "exports/runs/run-01.jsonl" holding 1 run and the file "exports/spend.json" holding 2 spend rows
    When the user runs "ledger ingest exports"
    Then the output says "ingested 1 run, 2 spend rows and 0 events into ledger.duckdb"

  @id=SCN-LEDGER-006 @status=planned
  Scenario: The answer of LiteLLM's spend logs endpoint is read as spend rows
    Given the file "spend.json" with the JSON array LiteLLM's "GET /spend/logs" returns, with 2 rows of 0.40 USD and 0.60 USD
    When the user runs "ledger report spend.json"
    Then "report.json" shows a total spend of 1.00 USD

  @id=SCN-LEDGER-007 @status=planned
  Scenario: A line that is no run, spend row or event is refused with its file and line
    Given the file "data.jsonl" whose line 2 is the text "hello world"
    When the user runs "ledger ingest data.jsonl"
    Then the command exits with code 2
    And the error output says "data.jsonl:2: not a run, a spend row or a CloudEvent"

  @id=SCN-LEDGER-008 @status=planned
  Scenario: An event that breaks its contract is refused with its file, line and path
    Given the file "events.jsonl" whose line 1 is a "pr.closed@v1" event without "merged"
    When the user runs "ledger ingest events.jsonl"
    Then the command exits with code 2
    And the error output names "events.jsonl:1", "pr.closed@v1" and "/data"

  @id=SCN-LEDGER-009 @status=planned
  Scenario: An event of another type is skipped and counted
    Given the file "events.jsonl" with 1 "gate.decided@v1" event and 1 "pr.opened@v1" event
    When the user runs "ledger ingest events.jsonl"
    Then the command exits with code 0
    And the output says "ingested 0 runs, 0 spend rows and 1 event into ledger.duckdb; skipped 1 event of another type"
