@module=factory-spec @owner=maintainers
Feature: Print the skills of a factory
  "factory skills" prints every skill that an agent of the factory uses as one JSON document, for a program such as the
  console's pages "/skills" and "/skills/<name>" (ADR 0135, ADR 0140): its name, description, source, files and the
  Markdown of its SKILL.md below the front matter, what it needs, and per agent the secret reference that gives each
  needed secret and what the agent lacks. It reads the skills with the rules of "factory lint", so a program never
  parses a SKILL.md itself. A skill that "factory lint" refuses is printed with its problems, so a program can show
  them; only a factory.yaml that does not fit the contract fails the command.

  @id=SCN-FSPEC-115 @status=implemented
  Scenario: The skills are printed with their needs, their agents and the Markdown below the front matter
    Given the skill "release-notes" whose SKILL.md has the metadata "opensoftware/secrets: LINEAR_TOKEN" and "opensoftware/hosts: api.linear.app" and the files "scripts/issue.sh" and "teams.md" beside it
    And a factory.yaml whose agent "triage" has the skill, the secret "ref:openbao/linear-token" and the egress host "api.linear.app"
    And whose agent "review" has the skills "./skills/release-notes" and "./skills/changelog" and only the egress host "github.com"
    When the console runs "factory skills"
    Then the command exits with code 0
    And it prints the skills "changelog" and "release-notes" in this order
    And "release-notes" has its description, the folder "skills/release-notes", the needs "LINEAR_TOKEN" and "api.linear.app", the files "SKILL.md", "scripts/issue.sh" and "teams.md", the Markdown "# Release notes" and no problem
    And its agent "review" lacks the secret "LINEAR_TOKEN" and the host "api.linear.app", and its agent "triage" gives "LINEAR_TOKEN" with "ref:openbao/linear-token" and lacks nothing

  @id=SCN-FSPEC-116 @status=implemented
  Scenario: A skill that lint refuses is printed with its problems
    Given a factory.yaml whose agent "triage" has the skills "./skills/release-notes" and "./skills/missing"
    And the SKILL.md of "release-notes" has the front matter "name: release-notes" and no description
    And the folder "skills/missing" holds only "README.md"
    When the console runs "factory skills"
    Then the command exits with code 0
    And "release-notes" has no description, its Markdown and the problem "skills/release-notes/SKILL.md:2:1 the skill has no description: say what it does and when to use it"
    And "missing" has no description, no Markdown, the file "README.md" and the problem "the skill \"./skills/missing\" has no SKILL.md"

  @id=SCN-FSPEC-117 @status=implemented
  Scenario: A factory.yaml that does not fit the contract fails "factory skills" with its problems
    Given a factory.yaml whose agent "triage" has no model and no effort
    When the console runs "factory skills"
    Then the command exits with code 1
    And the error is "factory.yaml:7:3 /agents/triage/model: missing required field" and "factory.yaml:7:3 /agents/triage/effort: missing required field"
    And the output is empty

  @id=SCN-FSPEC-118 @status=implemented
  Scenario: What "factory skills" prints is a valid skill catalog of the contracts, also for a skill that lint refuses
    Given the skill "release-notes" whose SKILL.md has the metadata "opensoftware/secrets: LINEAR_TOKEN" and "opensoftware/hosts: api.linear.app"
    And a factory.yaml whose agent "triage" has the skills "./skills/release-notes" and "./skills/missing", the secret "ref:openbao/linear-token" and only the egress host "github.com"
    When the console runs "factory skills"
    Then the command exits with code 0
    And the output is a valid skill-catalog with the skills "missing" and "release-notes"
