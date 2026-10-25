@module=channel-slack @owner=maintainers
Feature: Slack's own rules for the channel port
  channel-slack passes the channel port's scenarios in ports/channel/features/. These scenarios cover what only
  Slack asks of it (ADR 0059).

  @id=SCN-CSLACK-001 @status=implemented
  Scenario: A delivery that Slack signed more than 5 minutes ago is refused
    Given a delivery of the person's message that Slack signed at "2026-01-01T00:00:00Z"
    When the client runs "receive" on it with "OSF_NOW" set to "2026-01-01T00:05:01Z"
    Then receive exits with code 1 and an error that names the signature

  @id=SCN-CSLACK-002 @status=planned
  Scenario: A reply to a channel starts a new thread
    When the client runs "reply slack:C0WEB" with "Deploy 42 waits for approval"
    Then the test chat shows the bot's message "Deploy 42 waits for approval" at the top of the channel "C0WEB"
    And reply prints the thread of that message and its ID

  @id=SCN-CSLACK-003 @status=planned
  Scenario: An approval card asked in a channel starts a new thread
    When the client runs "ask slack:C0WEB" with "Deploy 42 to production?"
    Then the test chat shows the bot's card with "Deploy 42 to production?" and the choices "approve" and "reject" at the top of the channel "C0WEB"
    And ask prints the thread of that card and its ID

  @id=SCN-CSLACK-004 @status=planned
  Scenario: messages lists the messages at the top of a channel, each with its own thread
    Given the bot's message "Deploy 42 waits for approval" at the top of the channel "C0WEB"
    And the person's message "Lunch at noon?" after it
    When the client runs "messages slack:C0WEB"
    Then messages prints "Deploy 42 waits for approval" with "mine" true and then "Lunch at noon?" with "mine" false
    And each message's thread is "slack:C0WEB:" and its ID
    And each message's time has the microseconds of its ID
