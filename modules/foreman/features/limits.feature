@module=foreman @owner=maintainers
Feature: Stages side by side
  With FOREMAN_MAX_STAGES, a foreman runs at most that many stages with an agent at the same time, so a burst of work
  items does not start a sandbox for each at once (ADR 0160). A stage over the limit waits for a place, and its run goes
  on when one is free. A number setting that is not a whole number stops the server at its start.

  @id=SCN-FORE-190 @status=implemented
  Scenario: With FOREMAN_MAX_STAGES set to 1, the "plan" turns of two runs never run at the same time, and both runs complete
    Given "foreman serve" runs the README's "factory.yaml" with "FOREMAN_MAX_STAGES" set to "1" and a scripted harness whose "plan" turns fail while another "plan" turn runs
    When a program posts the README's "work.json" and a second work item to "/v1/runs" with the API token
    Then "/v1/runs/<id>" of each run shows the state "complete"
    And the harness received the prompt "Write a plan" twice

  @id=SCN-FORE-191 @status=implemented
  Scenario: A stage that waits for a place of FOREMAN_MAX_STAGES shows "blocked" since when it waits, and its run "running"
    Given "foreman serve" runs the README's "factory.yaml" with "FOREMAN_MAX_STAGES" set to "1" and a run of the README's "work.json" whose "plan" turn waits
    When a program posts a second work item to "/v1/runs" with the API token
    Then "/v1/runs/<id>" of the second run shows the state "running" and the stage "plan" "blocked" with "waitingSince" and without "startedAt"
    And the harness received the prompt "Write a plan" once

  @id=SCN-FORE-192 @status=implemented
  Scenario: A number setting that is not a whole number of 1 or more stops the server at the start
    Given the README's "factory.yaml"
    When the user runs "foreman serve" with "FOREMAN_MAX_STAGES" set to "0", and once with "FOREMAN_POLL_MS" set to "1s"
    Then each command exits with code 2
    And the outputs contain 'FOREMAN_MAX_STAGES is "0": set a whole number of 1 or more' and 'FOREMAN_POLL_MS is "1s": set a whole number of 1 or more'
