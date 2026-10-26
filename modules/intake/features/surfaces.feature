@module=intake @owner=maintainers
Feature: One work item across surfaces
  A Slack mention that links an issue takes the issue's link as its dedupe key, so the mention and the label on that
  issue are one work item, whichever comes first (ADR 0065).

  @id=SCN-INTAKE-024 @status=implemented @realizes=SCN-FACTORY-RUNTIME-002 @realizes=SCN-FACTORY-ACCESS-001
  Scenario: A Slack mention that links a labeled issue joins the issue's work item
    Given the server made a work item of the GitHub issue "Export reports as CSV" labeled "factory"
    When "U0PERSON" says "<@bot> please take <the issue's link>" in the Slack channel "C0WORK"
    Then the thread has the reply "Added to work item <id>."
    And "/v1/work-items/<id>" lists the requests from "github" and "slack"

  @id=SCN-INTAKE-025 @status=implemented @realizes=SCN-FACTORY-RUNTIME-002
  Scenario: The label on an issue that a Slack mention linked joins the mention's work item
    Given the server made a work item of the mention "<@bot> please take <the issue's link>" in the Slack channel "C0WORK"
    When "tester" adds the label "factory" to the issue
    Then "/v1/work-items/<id>" lists the requests from "slack" and "github"
    And the thread has one reply, "Received as work item <id>."
