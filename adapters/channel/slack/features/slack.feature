@module=channel-slack @owner=maintainers
Feature: Slack's own rules for the channel port
  channel-slack passes the channel port's scenarios in ports/channel/features/. These scenarios cover what only
  Slack asks of it (ADR 0059).

  @id=SCN-CSLACK-001 @status=implemented
  Scenario: A delivery that Slack signed more than 5 minutes ago is refused
    Given a delivery of the person's message that Slack signed at "2026-01-01T00:00:00Z"
    When the client runs "receive" on it with "OSF_NOW" set to "2026-01-01T00:05:01Z"
    Then receive exits with code 1 and an error that names the signature
