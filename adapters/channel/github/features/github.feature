@module=channel-github @owner=maintainers
Feature: GitHub's own rules for the channel port
  channel-github passes the channel port's scenarios in ports/channel/features/. These scenarios cover what only
  GitHub asks of it (ADR 0059).

  @id=SCN-CGITHUB-001 @status=implemented
  Scenario: A reply to a target that is not a GitHub thread is a usage error
    Given an open pull request in "tester/web"
    When the client runs "reply" with "On it" to "github:tester/web:<number>x" and "xgithub:tester/web:<number>"
    Then each reply exits with code 2 and the error "channel-github: name the thread as github:<owner>/<repo>:<number>"

  @id=SCN-CGITHUB-002 @status=implemented
  Scenario: The help names the form of a thread and GitHub's REST API
    When the client runs "--help"
    Then the help exits with code 0 and names a thread as "github:<owner>/<repo>:<number>" and GitHub's REST API

  @id=SCN-CGITHUB-003 @status=implemented
  Scenario: The title of a work item is the first line of the mention without its trailing spaces
    Given a delivery of the person's comment that mentions the bot with "Fix the checkout button on Safari   " and the next line "It does not react"
    When the client runs "receive" on it
    Then receive prints a work item with the title "Fix the checkout button on Safari" and both lines as its description
