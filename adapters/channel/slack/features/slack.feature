@module=channel-slack @owner=maintainers
Feature: Slack's own rules for the channel port
  channel-slack passes the channel port's scenarios in ports/channel/features/. These scenarios cover what only
  Slack asks of it (ADR 0059).

  @id=SCN-CSLACK-001 @status=implemented
  Scenario: A delivery that Slack signed more than 5 minutes ago is refused
    Given a delivery of the person's message that Slack signed at "2026-01-01T00:00:00Z"
    When the client runs "receive" on it with "OSF_NOW" set to "2026-01-01T00:05:01Z"
    Then receive exits with code 1 and an error that names the signature

  @id=SCN-CSLACK-002 @status=implemented
  Scenario: A reply to a channel starts a new thread and prints it
    When the client runs "reply" on "slack:C0WEB" with "Approval needed from maintainers"
    Then the test chat shows the bot's message "Approval needed from maintainers" that starts a thread in "C0WEB"
    And reply prints that thread as "slack:C0WEB:<ts>", the message's ID and its time

  @id=SCN-CSLACK-003 @status=implemented
  Scenario: The history of a channel lists the messages that start its threads
    Given the person's message "Lunch at noon?" in "C0WEB" and a reply "Yes" in its thread
    And the client ran "reply" on "slack:C0WEB" with "Approval needed from maintainers"
    When the client runs "history" on "slack:C0WEB"
    Then history prints "Lunch at noon?" and then "Approval needed from maintainers" with "mine" true, and not "Yes"

  @id=SCN-CSLACK-004 @status=implemented
  Scenario: An approval card's text is the question as the client gave it
    When the client runs "ask" on "slack:C0WEB" with "Approval needed from maintainers (risk high)" and the choices "Approve" and "Reject"
    Then the test chat shows the bot's message with the text "Approval needed from maintainers (risk high)"
    And the message has the buttons "Approve" and "Reject"
