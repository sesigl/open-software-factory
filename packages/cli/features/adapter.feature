@module=cli @owner=maintainers
Feature: Port adapters as programs
  A module runs a port's adapter as a program named by a command line (ADR 0060, ADR 0061). runAdapter starts it
  with the arguments and the variables, and gives the JSON lines it prints.

  @id=SCN-CLI-017 @status=implemented
  Scenario: runAdapter gives the JSON lines that the adapter prints, in order
    Given an adapter program that prints the lines {"id": 1} and {"id": 2} for "hooks acme/web"
    When the module runs the "forge adapter" with "hooks acme/web"
    Then it gets {"id": 1} and {"id": 2} in this order

  @id=SCN-CLI-018 @status=implemented
  Scenario: runAdapter gives the adapter the variables that the module names
    Given an adapter program that prints its variable "FORGE_URL" as {"url": "<value>"}
    When the module runs the "forge adapter" with "FORGE_URL" set to "https://forge.test"
    Then it gets {"url": "https://forge.test"}

  @id=SCN-CLI-019 @status=implemented
  Scenario: runAdapter names the command and the adapter's message when the adapter fails
    Given an adapter program that writes "the forge refused the token" to standard error and exits with code 1
    When the module runs the "forge adapter" with "hooks acme/web"
    Then it gets the error "hooks acme/web: the forge refused the token"

  @id=SCN-CLI-020 @status=implemented
  Scenario: runAdapter names the command line of an adapter that cannot start
    When the module runs the "forge adapter" "/opt/missing/forge-forgejo" with "hooks acme/web"
    Then it gets the error "could not start the forge adapter /opt/missing/forge-forgejo (ENOENT)"
