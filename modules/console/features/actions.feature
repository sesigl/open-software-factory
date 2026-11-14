@module=console @owner=maintainers
Feature: The actions of a run
  The run page lists the signals people sent the run, with the person who sent each and when the foreman took it
  (ADR 0118).

  @id=SCN-CONSOLE-080 @status=implemented
  Scenario: The run page lists the actions of a run with the person who sent each
    Given a foreman with a run that "ada@acme.dev" steered with "use the existing date helper" and "Leo" cancelled
    When a person opens the run's page
    Then the section "Actions" lists "steer: use the existing date helper by ada@acme.dev at 2026-01-01T00:01:00.000Z" and "cancel by Leo at 2026-01-01T00:02:00.000Z"
