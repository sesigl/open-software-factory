@module=postgres @owner=maintainers
Feature: Pool and transactions
  openPool gives a pg pool whose clients may lose their connection without ending the process, and transaction runs
  work between BEGIN and COMMIT on one client of it (ADR 0082).

  @id=SCN-PG-001 @status=implemented
  Scenario: A transaction commits the rows of its work
    Given a pool on a PostgreSQL database with the table "work"
    When a transaction inserts the rows "w-1" and "w-2" into "work"
    Then the transaction returns 2
    And "work" holds the rows "w-1" and "w-2"

  @id=SCN-PG-002 @status=implemented
  Scenario: A transaction whose work fails leaves no row
    Given a pool on a PostgreSQL database with the table "work"
    When a transaction inserts the row "w-1" into "work" and then fails with "no room"
    Then the transaction rejects with "no room"
    And "work" holds no row

  @id=SCN-PG-003 @status=implemented
  Scenario: The process goes on when the database stops while a transaction holds its client between two queries
    Given a pool on a PostgreSQL database with the table "work"
    And a transaction that inserted the row "w-1" into "work" and waits before its next query
    When the database stops
    And the transaction goes on with its next query
    Then the transaction rejects
    And no error ended the process

  @id=SCN-PG-004 @status=implemented
  Scenario: The process goes on when the database stops while the pool holds an idle client
    Given a pool on a PostgreSQL database with the table "work"
    And the pool holds an idle client after a query
    When the database stops
    Then the pool drops its idle client
    And no error ended the process

  @id=SCN-PG-005 @status=implemented
  Scenario: A pool opens at most four clients, and a fifth request waits for one
    Given a pool on a PostgreSQL database with the table "work"
    When five requests ask the pool for a client at once
    Then 1 request waits
    And the pool has 4 clients
