@port=channel @owner=maintainers
Feature: Work items, replies and approvals in any chat
  A channel adapter is a program with the commands receive, reply, ask and messages. It reaches the chat at CHANNEL_API_URL
  with the bot's token CHANNEL_TOKEN, and checks deliveries with CHANNEL_SIGNING_SECRET. receive turns one webhook
  delivery into a work item from contracts or a decision on an approval card; a thread is Vercel Chat SDK's thread ID
  (ADR 0059). The test chat has a bot and a person: the testkit's fake Slack with the channel "C0WEB" for the slack
  adapter, and the conversation of a pull request in the testkit's fake GitHub for the github adapter.

  @id=SCN-CHANNEL-001 @status=implemented @conformance @realizes=SCN-FACTORY-ACCESS-001
  Scenario: A mention of the bot becomes a work item with a link to the message
    Given a delivery of the person's message that mentions the bot with "Fix the checkout button on Safari"
    When the client runs "receive" on it
    Then receive prints a work item that the contract accepts with the title "Fix the checkout button on Safari"
    And the work item names the person as its requester and the message's thread as its origin and dedupe key
    And the work item's origin links to the message on the test chat

  @id=SCN-CHANNEL-002 @status=implemented @conformance
  Scenario: A message that does not mention the bot is not work
    Given a delivery of the person's message "Lunch at noon?" without a mention of the bot
    When the client runs "receive" on it
    Then receive exits with code 0 and prints nothing

  @id=SCN-CHANNEL-003 @status=implemented @conformance
  Scenario: The bot's own message is not work
    Given a delivery of the bot's own message that mentions the bot with "Fix the checkout button on Safari"
    When the client runs "receive" on it
    Then receive exits with code 0 and prints nothing

  @id=SCN-CHANNEL-004 @status=implemented @conformance
  Scenario: A delivery whose signature does not match the signing secret is refused
    Given a delivery of the person's message that mentions the bot with "Fix the checkout button on Safari"
    When the client runs "receive" on it with "CHANNEL_SIGNING_SECRET" set to "other-secret"
    Then receive exits with code 1 and an error that names the signature
    And receive prints nothing

  @id=SCN-CHANNEL-005 @status=implemented @conformance
  Scenario: A reply lands in the thread of the work item
    Given a work item that receive printed for the person's message
    When the client runs "reply" on its thread with "On it: run 7 started"
    Then the test chat shows the bot's message "On it: run 7 started" in that thread
    And reply prints the thread and the message's ID

  @id=SCN-CHANNEL-006 @status=implemented @conformance
  Scenario: An approval card shows the question and its choices in the thread
    Given a work item that receive printed for the person's message
    When the client runs "ask" on its thread with "Merge pull request 12 into main?"
    Then the test chat shows the bot's card in that thread with "Merge pull request 12 into main?" and the choices "approve" and "reject"
    And ask prints the thread and the card's ID

  @id=SCN-CHANNEL-007 @status=implemented @conformance @realizes=SCN-FACTORY-ACCESS-003
  Scenario: A person's choice on an approval card is a decision with the person's identity
    Given the client ran "ask" on a thread with "Merge pull request 12 into main?"
    And a delivery of the person choosing "approve" on that card
    When the client runs "receive" on it
    Then receive prints the decision "approve" on that card in that thread by the person

  @id=SCN-CHANNEL-008 @status=implemented @conformance
  Scenario: A choice that the card does not offer is not a decision
    Given the client ran "ask" on a thread with "Deploy to production?" and the choices "ship" and "wait"
    And a delivery of the person answering "approve" in that thread
    When the client runs "receive" on it
    Then receive exits with code 0 and prints nothing

  @id=SCN-CHANNEL-009 @status=implemented @conformance
  Scenario: A token the chat refuses is named
    Given a work item that receive printed for the person's message
    When the client runs "reply" on its thread with "CHANNEL_TOKEN" set to "not-a-token"
    Then reply exits with code 1 and the error "the channel refused the token"

  @id=SCN-CHANNEL-010 @status=planned @conformance
  Scenario: messages lists the messages of a thread, oldest first
    Given a work item that receive printed for the person's message
    And the client ran "reply" on its thread with "On it: run 7 started"
    When the client runs "messages" on that thread
    Then messages prints the person's message and then the bot's message "On it: run 7 started"
    And the person's message has the person as its author and "mine" false
    And the bot's message has "mine" true
    And each message has its ID, the thread and its time
