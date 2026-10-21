@module=ledger @owner=maintainers
Feature: Grafana dashboard
  "ledger dashboard" writes a Grafana dashboard for import. Its panels read the views of a PostgreSQL database that
  ledger fills.

  @id=SCN-LEDGER-034 @status=implemented @realizes=SCN-FACTORY-METRIC-004
  Scenario: The dashboard asks for a PostgreSQL data source on import
    When the user runs "ledger dashboard"
    Then the command exits with code 0
    And the output says "wrote" and the path of "ledger-dashboard.json"
    And "ledger-dashboard.json" has one data source input of the type "grafana-postgresql-datasource"

  @id=SCN-LEDGER-035 @status=implemented @realizes=SCN-FACTORY-METRIC-003 @realizes=SCN-FACTORY-METRIC-005 @realizes=SCN-FACTORY-METRIC-008
  Scenario: Every panel of the dashboard reads the views of the database
    Given the sample file from the README ingested into a PostgreSQL database
    And "ledger-dashboard.json" written by "ledger dashboard"
    When the user runs the SQL of each panel with "ledger query --db <database URL>" for the time range from 2026-01-01 to 2026-01-02
    Then every command exits with code 0
    And every command prints at least one row

  @id=SCN-LEDGER-036 @status=implemented @realizes=SCN-FACTORY-METRIC-004
  Scenario: The panel "Cost per pull request" shows the cost of the README sample
    Given the sample file from the README ingested into a PostgreSQL database
    And "ledger-dashboard.json" written by "ledger dashboard"
    When the user runs the SQL of the panel "Cost per pull request" with "ledger query --db <database URL>" for the time range from 2026-01-01 to 2026-01-02
    Then the output is {"Cost per pull request":1.75}

  @id=SCN-LEDGER-037 @status=implemented @realizes=SCN-FACTORY-METRIC-004
  Scenario: The dashboard variables add compute and platform cost
    Given 2 pull requests, spend rows of 10.00 USD in total and runs of 4 hours in total, ingested into a PostgreSQL database
    And "ledger-dashboard.json" written by "ledger dashboard"
    When the user runs the SQL of the panel "Cost per pull request" with "ledger query --db <database URL>", "compute_usd_per_hour" 0.50 and "platform_usd" 6
    Then the output is {"Cost per pull request":9}
