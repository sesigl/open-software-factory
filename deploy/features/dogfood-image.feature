@module=deploy @owner=maintainers
Feature: The agents of this repository's factory check this repository in their sandboxes
  The factory in "deploy/dogfood/factory/" implements this repository's issues. Its agents run in sandboxes of the
  image that the service "dogfood-template" of the Compose profile builds: the agents' template with pnpm at the
  version of "packageManager" in "package.json" and lychee at the version that "make install" pins, the tools of
  "make check-fast". The service passes both versions as build arguments, which "osf profile-pins" writes from those
  pins and PROFILE keeps current (ADR 0172). The sandbox has no Docker, so the checks of the pull request run the
  suites (ADR 0164).

  @id=SCN-DIST-070 @status=implemented
  Scenario: The agents' template of this repository's factory has Node 24, Git, make, and pnpm and lychee at the repository's pins
    Given the module images of the Compose profile built from this workspace with "node scripts/images.ts", at the tags that "compose.yaml" pins
    When the operator runs "node --version", "pnpm --version", "git --version", "make --version", "lychee --version" and "printenv TURBO_CONCURRENCY" in the service "dogfood-template" with "docker compose run --rm --no-deps"
    Then the command exits with code 0
    And the output names Node "v24.", pnpm at the build argument "PNPM_VERSION" of "dogfood-template", "git version", "GNU Make" and lychee at its build argument "LYCHEE_VERSION", one per line
    And turbo runs at most "4" tasks at a time, so the typechecks of "make check-fast" fit the sandbox's memory

  @id=SCN-DIST-071 @status=implemented
  Scenario: This repository's factory starts every agent from the image of "dogfood-template", and its prompts ask for "make check-fast"
    Given the Compose profile with every value of ".env.example" set in ".env" and "FACTORY_DIR" set to "../dogfood/factory"
    When the operator runs "docker compose run --rm factory resolve" and prints each agent's prompt with "docker compose run --rm"
    Then the command exits with code 0
    And the sandbox of each of the agents "triage", "spec", "implement", "review" and "ship" has the template that is the image of the service "dogfood-template"
    And each prompt names "make check-fast" and none names "make verify"
