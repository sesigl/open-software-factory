@module=tools @owner=maintainers
Feature: Setup of a factory from a clone
  "osf init", "osf up" and "osf doctor" take a new team from a clone of this repository to a healthy factory on the
  Compose profile in deploy/compose/ (T-30, ADR 0119). They are thin wrappers: init writes the profile's .env, up and
  doctor run "docker compose" there. OSF_DOCKER names the docker command; the scenarios give a fake one that logs
  its arguments, so none of them needs Docker.

  @id=SCN-REPO-132 @status=implemented
  Scenario: osf init writes .env with the factory's own secrets generated and the other values empty
    Given a "deploy/compose/.env.example" with "POSTGRES_PASSWORD=", "LITELLM_MASTER_KEY=sk-", "FOREMAN_API_TOKEN=", "GATEKEEPER_FORGE_TOKEN=" and a comment
    When the developer runs "osf init"
    Then the command exits with code 0
    And "deploy/compose/.env" sets "POSTGRES_PASSWORD" and "FOREMAN_API_TOKEN" to two different values of 64 hex digits
    And "deploy/compose/.env" sets "LITELLM_MASTER_KEY" to "sk-" and 64 hex digits
    And "deploy/compose/.env" has the line "GATEKEEPER_FORGE_TOKEN=" and the comment
    And the output names "GATEKEEPER_FORGE_TOKEN" and "factory/groups.json" as what to set next

  @id=SCN-REPO-133 @status=implemented
  Scenario: osf init keeps an existing .env
    Given a "deploy/compose/.env.example" with "POSTGRES_PASSWORD="
    And a "deploy/compose/.env" with "POSTGRES_PASSWORD=mine"
    When the developer runs "osf init"
    Then the command exits with code 0
    And "deploy/compose/.env" still has "POSTGRES_PASSWORD=mine"
    And the output contains "deploy/compose/.env exists: kept it"

  @id=SCN-REPO-134 @status=implemented
  Scenario: osf init --factory copies the reference factory and points FACTORY_DIR at it
    Given a "deploy/compose/.env.example" with "FACTORY_DIR="
    And a reference factory in "deploy/compose/factory/" with "factory.yaml" and "groups.json"
    When the developer runs "osf init --factory team/factory"
    Then the command exits with code 0
    And "team/factory/factory.yaml" and "team/factory/groups.json" are copies of the reference factory's
    And "deploy/compose/.env" has the line "FACTORY_DIR=../../team/factory"

  @id=SCN-REPO-135 @status=implemented
  Scenario: osf up refuses a missing .env, an empty required value and gatekeeper without a channel
    Given a "deploy/compose/compose.yaml" that requires "POSTGRES_PASSWORD" with "${POSTGRES_PASSWORD:?...}"
    And a fake docker that logs its arguments
    When the developer runs "osf up" without a "deploy/compose/.env"
    Then the command exits with code 1
    And the output contains "deploy/compose/.env is missing: run osf init"
    When the developer runs "osf up" with a ".env" whose "POSTGRES_PASSWORD" and gatekeeper values are empty
    Then the command exits with code 1
    And the output contains "set POSTGRES_PASSWORD in deploy/compose/.env"
    And the output contains "set GATEKEEPER_SLACK_CHANNEL, GATEKEEPER_SLACK_TOKEN and GATEKEEPER_SLACK_SIGNING_SECRET, or GATEKEEPER_FORGE_TOKEN, in deploy/compose/.env"
    And the fake docker was not called

  @id=SCN-REPO-136 @status=implemented
  Scenario: osf up starts the Compose profile and waits until it is healthy
    Given a "deploy/compose/compose.yaml" that requires "POSTGRES_PASSWORD" with "${POSTGRES_PASSWORD:?...}"
    And a "deploy/compose/.env" with "POSTGRES_PASSWORD" and "GATEKEEPER_FORGE_TOKEN" set
    And a fake docker that logs its arguments and its folder
    When the developer runs "osf up"
    Then the command exits with code 0
    And the fake docker ran "compose up --detach --wait" in "deploy/compose"

  @id=SCN-REPO-137 @status=implemented
  Scenario: osf doctor runs console doctor in the profile and exits with its code
    Given a fake docker that logs its arguments and its folder, prints "FAIL  groups: put a real member" and exits with code 1
    When the developer runs "osf doctor"
    Then the command exits with code 1
    And the output contains "FAIL  groups: put a real member"
    And the fake docker ran "compose run --rm console console doctor" in "deploy/compose"
