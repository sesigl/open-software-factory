@module=intake @owner=maintainers
Feature: The event work.received@v1
  A new work item is published as "work.received@v1" through a PostgreSQL outbox, at least once, with the work item's
  ID as the event ID (ADR 0063).

  @id=SCN-INTAKE-010 @status=planned @realizes=SCN-FACTORY-LOOP-001
  Scenario: A new work item is published as the event "work.received@v1"
    Given the server runs with "INTAKE_NATS_URL" set to a NATS server
    When a program posts the README's "work.json" to "/v1/work-items" with the API token
    Then the event "work.received@v1" arrives on "osf.work.received.v1" with the work item's ID and title

  @id=SCN-INTAKE-011 @status=planned
  Scenario: A second request for the same work item publishes no second event
    Given the server, with "INTAKE_NATS_URL" set to a NATS server, received the README's "work.json"
    When a program posts a submission with the dedupe key "idea:export-csv" from the origin "slack"
    Then the event "work.received@v1" arrives on "osf.work.received.v1" once

  @id=SCN-INTAKE-012 @status=planned
  Scenario: An event of a time when NATS was unreachable is published once the server reaches NATS
    Given the server, with "INTAKE_NATS_URL" set to a port where no NATS listens, received the README's "work.json"
    When the server starts again with "INTAKE_NATS_URL" set to a NATS server
    Then the event "work.received@v1" arrives on "osf.work.received.v1" once
