@module=observer @owner=maintainers
Feature: Check the effect of a merged change
  "observer check" compares the failure rate of a problem's scorer before and after a merged change, with a minimum
  number of runs on each side and a test against chance.

  @id=SCN-OBS-020 @status=implemented @realizes=SCN-FACTORY-IMPROVE-005
  Scenario: Check reports that the failure rate fell after the merged change
    Given "scores.jsonl" where "research-skill-used" failed 30 of 40 runs before "2026-01-10T00:00:00Z" and 2 of 20 runs after it
    When the user runs "observer check --problem research-skill-used --merged-at 2026-01-10T00:00:00Z scores.jsonl"
    Then the command exits with code 0
    And the output says "research-skill-used: 75.0% before (30 of 40 runs), 10.0% after (2 of 20 runs): fell"
    And "$OUTPUT/check.json" has the verdict "fell"

  @id=SCN-OBS-021 @status=implemented
  Scenario: Fewer than 20 runs after the change give the verdict "not enough runs"
    Given "scores.jsonl" where "research-skill-used" failed 30 of 40 runs before "2026-01-10T00:00:00Z" and 0 of 5 runs after it
    When the user runs "observer check --problem research-skill-used --merged-at 2026-01-10T00:00:00Z scores.jsonl"
    Then the output says "research-skill-used: 75.0% before (30 of 40 runs), 0.0% after (0 of 5 runs): not enough runs"
    And "$OUTPUT/check.json" has the verdict "not enough runs"

  @id=SCN-OBS-022 @status=implemented
  Scenario: The option "--min-runs" sets the runs each side needs
    Given "scores.jsonl" where "research-skill-used" failed 30 of 40 runs before "2026-01-10T00:00:00Z" and 0 of 5 runs after it
    When the user runs "observer check --problem research-skill-used --merged-at 2026-01-10T00:00:00Z --min-runs 5 scores.jsonl"
    Then "$OUTPUT/check.json" has the verdict "fell"

  @id=SCN-OBS-023 @status=implemented
  Scenario: A small drop within chance is no clear change
    Given "scores.jsonl" where "research-skill-used" failed 4 of 20 runs before "2026-01-10T00:00:00Z" and 3 of 20 runs after it
    When the user runs "observer check --problem research-skill-used --merged-at 2026-01-10T00:00:00Z scores.jsonl"
    Then "$OUTPUT/check.json" has the verdict "no clear change"

  @id=SCN-OBS-024 @status=implemented
  Scenario: A clear rise is reported as "rose"
    Given "scores.jsonl" where "research-skill-used" failed 2 of 20 runs before "2026-01-10T00:00:00Z" and 12 of 20 runs after it
    When the user runs "observer check --problem research-skill-used --merged-at 2026-01-10T00:00:00Z scores.jsonl"
    Then "$OUTPUT/check.json" has the verdict "rose"

  @id=SCN-OBS-025 @status=implemented
  Scenario: Check reads the merge time of the pull request from the forge
    Given "scores.jsonl" where "research-skill-used" failed 30 of 40 runs before "2026-01-10T00:00:00Z" and 2 of 20 runs after it
    And a forge API that answers the pull request 12 of "acme/factory" as merged at "2026-01-10T00:00:00Z"
    When the user runs "observer check --problem research-skill-used --pull-request https://github.com/acme/factory/pull/12 scores.jsonl"
    Then the output says "research-skill-used: 75.0% before (30 of 40 runs), 10.0% after (2 of 20 runs): fell"

  @id=SCN-OBS-026 @status=implemented
  Scenario: A pull request that is not merged exits 1
    Given "scores.jsonl" where "research-skill-used" failed 30 of 40 runs before "2026-01-10T00:00:00Z" and 2 of 20 runs after it
    And a forge API that answers the pull request 12 of "acme/factory" as open
    When the user runs "observer check --problem research-skill-used --pull-request https://github.com/acme/factory/pull/12 scores.jsonl"
    Then the command exits with code 1
    And the error output says "observer: the pull request https://github.com/acme/factory/pull/12 is not merged"

  @id=SCN-OBS-027 @status=implemented
  Scenario: The option "--comment" posts the result on the pull request
    Given "scores.jsonl" where "research-skill-used" failed 30 of 40 runs before "2026-01-10T00:00:00Z" and 2 of 20 runs after it
    And a forge API that answers the pull request 12 of "acme/factory" as merged at "2026-01-10T00:00:00Z"
    When the user runs "observer check --problem research-skill-used --pull-request https://github.com/acme/factory/pull/12 --comment scores.jsonl" with "OBSERVER_FORGE_TOKEN" "forge-token"
    Then the forge got a comment on the pull request 12 that says "research-skill-used: 75.0% before (30 of 40 runs), 10.0% after (2 of 20 runs): fell"
    And the comment was sent with the header "authorization: token forge-token"

  @id=SCN-OBS-028 @status=implemented
  Scenario: Check places a run by its start in its run record, not by the time of its score
    Given "scores.jsonl" with scores of "research-skill-used" written at "2026-01-12T00:00:00Z": 30 failed of 40 runs that started before "2026-01-10T00:00:00Z" and 2 failed of 20 runs that started after it
    And run records in "runs/" with the start of each of these 60 runs
    When the user runs "observer check --problem research-skill-used --merged-at 2026-01-10T00:00:00Z --runs runs scores.jsonl"
    Then the output says "research-skill-used: 75.0% before (30 of 40 runs), 10.0% after (2 of 20 runs): fell"

  @id=SCN-OBS-032 @status=implemented
  Scenario: A URL that is no pull request exits 2
    Given "scores.jsonl" where "research-skill-used" failed 30 of 40 runs before "2026-01-10T00:00:00Z" and 2 of 20 runs after it
    When the user runs "observer check --problem research-skill-used --pull-request https://github.com/acme/factory/issues/12 scores.jsonl"
    Then the command exits with code 2
    And the error output says "observer: https://github.com/acme/factory/issues/12 is not a pull request URL like https://github.com/acme/factory/pull/12"
