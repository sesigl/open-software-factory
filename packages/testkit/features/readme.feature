@module=testkit @owner=maintainers
Feature: What a README documents
  The export `@opensoftware/testkit/readme` gives programs that check a module without running a test, like the
  BOUNDARY-ENV check, the README rules the testkit applies when a test starts the module.

  @id=SCN-TK-047 @status=implemented
  Scenario: documentedEnv gives the variables named in the Configuration section
    Given a README that names `DEMO_HOME` and `DEMO_URL` under "## Configuration" and `OTHER_VAR` under "## Usage"
    When the program asks for the documented environment variables
    Then it gets "DEMO_HOME" and "DEMO_URL"

  @id=SCN-TK-048 @status=implemented
  Scenario: readmeSection gives an empty text for a missing section
    Given a README with the sections "Usage" and "Configuration"
    When the program asks for the section "Quick start"
    Then it gets an empty text
