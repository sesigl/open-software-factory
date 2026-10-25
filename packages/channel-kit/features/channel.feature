@module=channel-kit @owner=maintainers
Feature: The commands of a channel adapter around a chat
  A channel adapter gives runChannel its name, the form of its threads, a receive that registers handlers and gives
  the chat's webhook, and a post that posts in a thread. runChannel reads the command line and runs receive, reply or
  ask (ADR 0059). The scenarios use the channel "demo" with threads like "demo:7".

  @id=SCN-CKIT-001 @status=implemented
  Scenario: receive prints the line a handler keeps for the delivery
    Given the channel "demo" whose webhook hands the delivery's body to a handler that keeps it as the line "said"
    And the delivery file "delivery.json" with the body "hello"
    When the adapter runs "receive delivery.json"
    Then the exit code is 0
    And standard output is the JSON line {"said": "hello"}

  @id=SCN-CKIT-002 @status=implemented
  Scenario: receive names the signature when the chat's webhook answers 401
    Given the channel "demo" whose webhook answers 401
    And the delivery file "delivery.json" with the body "hello"
    When the adapter runs "receive delivery.json"
    Then the exit code is 1
    And standard error is "demo: the delivery's signature does not match CHANNEL_SIGNING_SECRET"

  @id=SCN-CKIT-003 @status=implemented
  Scenario: receive fails with the error of a handler
    Given the channel "demo" whose webhook hands the delivery to a handler that fails with "the channel refused the token"
    And the delivery file "delivery.json" with the body "hello"
    When the adapter runs "receive delivery.json"
    Then the exit code is 1
    And standard error is "demo: the channel refused the token"
    And standard output is empty

  @id=SCN-CKIT-004 @status=implemented
  Scenario: A delivery file without a body is a usage error
    Given the channel "demo"
    And the delivery file "delivery.json" with headers and no body
    When the adapter runs "receive delivery.json"
    Then the exit code is 2
    And standard error names the form {"headers": {...}, "body": "..."}

  @id=SCN-CKIT-005 @status=implemented
  Scenario: reply posts the text in the thread and prints the message's ID
    Given the channel "demo" whose post gives the ID "m-1"
    When the adapter runs 'reply demo:7 "On it"'
    Then the channel posted the text "On it" in "demo:7"
    And standard output is the JSON line {"thread": "demo:7", "id": "m-1"}

  @id=SCN-CKIT-006 @status=implemented
  Scenario: ask without choices posts an approval card with "approve" and "reject"
    Given the channel "demo" whose post gives the ID "m-2"
    When the adapter runs 'ask demo:7 "Merge pull request 12?"'
    Then the channel posted the question "Merge pull request 12?" with the choices "approve" and "reject" in "demo:7"
    And standard output is the JSON line {"thread": "demo:7", "id": "m-2"}

  @id=SCN-CKIT-007 @status=implemented
  Scenario: A thread that does not have the channel's form is a usage error
    Given the channel "demo" whose threads have the form "demo:<number>"
    When the adapter runs 'reply slack:C0WEB:1 "On it"'
    Then the exit code is 2
    And standard error is "demo: name the thread as demo:<number>"
    And the channel posted nothing

  @id=SCN-CKIT-008 @status=implemented
  Scenario: history prints one JSON line per message of the thread, in the channel's order
    Given the channel "demo" whose history of "demo:7" gives the messages "m-1" of "demo:U1" and "m-2" of the bot
    When the adapter runs "history demo:7"
    Then standard output is the JSON lines of "m-1" and "m-2" in this order, "m-2" with "mine" true

  @id=SCN-CKIT-009 @status=implemented
  Scenario: receive hands the threads named with --thread to the channel
    Given the channel "demo"
    And the delivery file "delivery.json" with the body "hello"
    When the adapter runs "receive delivery.json --thread demo:7 --thread demo:8"
    Then the channel was asked to follow "demo:7" and "demo:8"

  @id=SCN-CKIT-010 @status=implemented
  Scenario: reply to a channel prints the thread that the post started and the message's time
    Given the channel "demo" with the channel "demo", whose post gives the ID "m-3" in the new thread "demo:9" at "2026-01-01T00:00:00.000001Z"
    When the adapter runs 'reply demo "Approval needed"'
    Then the channel posted the text "Approval needed" in "demo"
    And standard output is the JSON line {"thread": "demo:9", "id": "m-3", "time": "2026-01-01T00:00:00.000001Z"}

  @id=SCN-CKIT-011 @status=implemented
  Scenario: A channel is a usage error for a chat without channels
    Given the channel "demo" whose threads have the form "demo:<number>" and that has no channels
    When the adapter runs 'reply demo "On it"'
    Then the exit code is 2
    And standard error is "demo: name the thread as demo:<number>"
    And the channel posted nothing
