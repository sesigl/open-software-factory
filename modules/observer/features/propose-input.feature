@module=observer @owner=maintainers
Feature: Refuse a proposal before any change
  "observer propose" checks the problem, the configuration and the model's answer before it pushes anything.

  @id=SCN-OBS-017 @status=implemented
  Scenario: A problem that is not in the file exits 2 and names the problems
    Given "problems.json" with the problem "research-skill-used" of 30 failures in 40 runs
    When the user runs "observer propose --repo https://github.com/acme/factory --problem scope-creep problems.json"
    Then the command exits with code 2
    And the error output says "observer: no problem "scope-creep" in problems.json; it has: research-skill-used"

  @id=SCN-OBS-018 @status=implemented
  Scenario: A problem with fewer than two failed runs gets no proposal
    Given "problems.json" with the problem "research-skill-used" of 1 failure in 40 runs
    When the user runs "observer propose --repo https://github.com/acme/factory problems.json"
    Then the command exits with code 1
    And the error output says "observer: the problem research-skill-used has 1 failed run; a proposal needs at least 2"

  @id=SCN-OBS-019 @status=implemented
  Scenario: Propose without a model gateway exits 2
    Given "problems.json" with the problem "research-skill-used" of 30 failures in 40 runs
    When the user runs "observer propose --repo https://github.com/acme/factory problems.json" without "OBSERVER_INFERENCE_URL"
    Then the command exits with code 2
    And the error output says "observer: set OBSERVER_INFERENCE_URL to an OpenAI-compatible gateway"

  @id=SCN-OBS-030 @status=implemented
  Scenario: A repository URL that names no repository exits 2
    Given "problems.json" with the problem "research-skill-used" of 30 failures in 40 runs
    When the user runs "observer propose --repo https://github.com/acme problems.json"
    Then the command exits with code 2
    And the error output says "observer: https://github.com/acme is not a repository URL like https://github.com/acme/factory"

  @id=SCN-OBS-031 @status=implemented
  Scenario: A repository that cannot be cloned exits 1
    Given "problems.json" with the problem "research-skill-used" of 30 failures in 40 runs
    When the user runs "observer propose --repo http://127.0.0.1:9/acme/factory problems.json"
    Then the command exits with code 1
    And the error output starts with "observer: git clone failed"
