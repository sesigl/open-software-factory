@module=ledger @owner=maintainers
Feature: PostgreSQL
  "--db" or "LEDGER_DB" names a PostgreSQL database instead of a DuckDB file. ledger creates the same tables and
  views there, and "ledger report" gives the same report as from a DuckDB file.

  @id=SCN-LEDGER-030 @status=implemented @realizes=SCN-FACTORY-METRIC-004
  Scenario: Ingest writes into the PostgreSQL database that "LEDGER_DB" names and hides its password
    Given the sample file from the README
    And a PostgreSQL database with the user "test" and the password "test"
    When the user runs "ledger ingest ledger.jsonl" with "LEDGER_DB" set to the database's URL
    Then the command exits with code 0
    And the output says "ingested 2 runs, 2 spend rows and 3 events into postgres://test:***@"

  @id=SCN-LEDGER-031 @status=implemented @realizes=SCN-FACTORY-METRIC-004
  Scenario: The report from PostgreSQL equals the report from a DuckDB file
    Given runs, spend rows, work items, reviews, merges and a revert in "data.jsonl"
    And "duckdb.json" written by "ledger report --out duckdb.json data.jsonl"
    When the user runs "ledger report --db <database URL> --out postgres.json data.jsonl"
    Then the command exits with code 0
    And "postgres.json" equals "duckdb.json"

  @id=SCN-LEDGER-032 @status=implemented @realizes=SCN-FACTORY-METRIC-004
  Scenario: Ingesting the same file twice into PostgreSQL counts each record once
    Given the sample file from the README ingested once into a PostgreSQL database
    When the user runs "ledger report --db <database URL> ledger.jsonl"
    Then the command exits with code 0
    And "report.json" shows 2 pull requests and a cost per pull request of 1.75 USD

  @id=SCN-LEDGER-033 @status=implemented @realizes=SCN-FACTORY-METRIC-006
  Scenario: "ledger query" prints the rows of the view "pr_cost" in PostgreSQL
    Given the sample file from the README ingested into a PostgreSQL database
    When the user runs "ledger query --db <database URL> SELECT url, inference_usd FROM pr_cost ORDER BY url"
    Then the command exits with code 0
    And the output has the line {"url":"https://github.com/acme/web/pull/1","inference_usd":2.5}
    And the output has the line {"url":"https://github.com/acme/web/pull/2","inference_usd":1}

  @id=SCN-LEDGER-038 @status=implemented
  Scenario: A database that refuses the password exits 1 without printing the password
    Given a PostgreSQL database with the user "test" and the password "test"
    When the user runs "ledger report" with "LEDGER_DB" set to the database's URL with the password "wrong-password"
    Then the command exits with code 1
    And the error output says "ledger: cannot open postgres://test:***@"
    And the output and the error output do not contain "wrong-password"
