@module=intake @owner=maintainers
Feature: Work from Slack
  A Slack message that mentions the bot becomes a work item through the channel port's adapter, and intake answers
  in its thread (ADR 0063).

  @id=SCN-INTAKE-013 @status=planned @realizes=SCN-FACTORY-ACCESS-001 @realizes=SCN-FACTORY-ACCESS-003
  Scenario: A Slack mention becomes a work item with a link to the message
    Given the server runs with the Slack channel adapter
    When "U0PERSON" says "<@bot> Export reports as CSV" in the Slack channel "C0WORK"
    Then the thread has the reply "Received as work item <id>."
    And "/v1/work-items/<id>" shows the requester "slack:U0PERSON" named "Varun" and a link to the message

  @id=SCN-INTAKE-014 @status=planned
  Scenario: A second mention in the same thread is the same work item and gets no second reply
    Given the server made a work item of the mention "<@bot> Export reports as CSV" in the Slack channel "C0WORK"
    When "U0PERSON" says "<@bot> also as Excel" in the thread
    Then the thread has one reply, "Received as work item <id>."

  @id=SCN-INTAKE-015 @status=planned
  Scenario: A Slack delivery with a wrong signature gets the status 401 and makes no work item
    Given the server runs with the Slack channel adapter
    When a mention "<@bot> Export reports as CSV" by "U0PERSON" arrives with a wrong signature
    Then the answer has the status 401
    And the Slack channel "C0WORK" has no reply

  @id=SCN-INTAKE-016 @status=planned
  Scenario: Slack's URL verification gets its challenge back
    Given the server runs with the Slack channel adapter
    When Slack sends the signed "url_verification" with the challenge "3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P"
    Then the answer has the status 200 and the challenge "3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P"
