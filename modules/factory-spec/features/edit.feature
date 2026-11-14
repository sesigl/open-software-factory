@module=factory-spec @owner=maintainers
Feature: Edit factory.yaml
  "factory edit" makes one change to factory.yaml for a program, such as the console, that commits the result as a
  pull request (T-58): it adds or removes a skill, a secret reference or an egress host of an agent, or adds a secrets
  provider. It prints the edited factory.yaml and leaves the file as it is. The output keeps the comments, the order of
  the keys and the anchors. An agent that shares a list with the edited agent through an anchor keeps its list. An edit
  whose result would not pass "factory lint" prints nothing, names the problem on one line and exits with code 1.

  @id=SCN-FSPEC-073 @status=implemented
  Scenario: The edit of one agent keeps comments and leaves an agent that shared the list unchanged
    Given a factory.yaml with comments whose agents "triage", "spec" and "review" share the secrets of "triage" through the anchor "&secrets"
    When the console runs "factory edit add-secret spec ref:env/LINEAR_TOKEN"
    Then the command exits with code 0
    And the output is factory.yaml with only the line "secrets: *secrets" of "spec" changed to "secrets: [ref:env/GH_TOKEN, ref:env/CLAUDE_CODE_OAUTH_TOKEN, ref:env/LINEAR_TOKEN]"
    And "factory resolve" of the output gives "triage" and "review" the secrets "ref:env/GH_TOKEN" and "ref:env/CLAUDE_CODE_OAUTH_TOKEN"

  @id=SCN-FSPEC-074 @status=implemented
  Scenario: The edit of the agent that holds the anchor passes the anchor on to the agents that shared the list
    Given a factory.yaml with comments whose agents "triage", "spec" and "review" share the sandbox of "triage" through the anchor "&sandbox"
    When the console runs "factory edit add-egress triage registry.npmjs.org"
    Then the command exits with code 0
    And "factory resolve" of the output gives "triage" the egress hosts "litellm", "github.com" and "registry.npmjs.org"
    And "factory resolve" of the output gives "spec" and "review" the egress hosts "litellm" and "github.com"
    And in the output "spec" holds the anchor "&sandbox" and "review" still uses it with "*sandbox"
    And the output keeps every comment of factory.yaml

  @id=SCN-FSPEC-075 @status=implemented
  Scenario: Edit adds a skill to an agent that has none and leaves factory.yaml as it is
    Given a factory.yaml whose agent "triage" has no skills
    And the skill folder "skills/review"
    When the console runs "factory edit add-skill triage ./skills/review"
    Then the command exits with code 0
    And "factory resolve" of the output gives "triage" the skills "./skills/review"
    And factory.yaml in the factory folder is unchanged

  @id=SCN-FSPEC-076 @status=implemented
  Scenario: Edit removes a skill from an agent
    Given a factory.yaml whose agent "triage" has the skills "./skills/review" and "./skills/testing"
    When the console runs "factory edit remove-skill triage ./skills/review"
    Then the command exits with code 0
    And "factory resolve" of the output gives "triage" the skills "./skills/testing"

  @id=SCN-FSPEC-077 @status=implemented
  Scenario: Edit removes a secret reference and keeps the list on one line
    Given a factory.yaml whose agent "triage" has the line "secrets: [ref:env/GH_TOKEN, ref:env/LINEAR_TOKEN]"
    When the console runs "factory edit remove-secret triage ref:env/LINEAR_TOKEN"
    Then the command exits with code 0
    And the output has the line "secrets: [ref:env/GH_TOKEN]" in place of "secrets: [ref:env/GH_TOKEN, ref:env/LINEAR_TOKEN]"

  @id=SCN-FSPEC-078 @status=implemented
  Scenario: Edit removes an egress host from an agent that shares its sandbox
    Given a factory.yaml with comments whose agents "triage", "spec" and "review" share the sandbox of "triage" through the anchor "&sandbox"
    When the console runs "factory edit remove-egress spec github.com"
    Then the command exits with code 0
    And "factory resolve" of the output gives "spec" the egress hosts "litellm"
    And "factory resolve" of the output gives "triage" and "review" the egress hosts "litellm" and "github.com"

  @id=SCN-FSPEC-079 @status=implemented
  Scenario: Edit adds a secrets provider
    Given a factory.yaml that declares no secrets provider
    When the console runs "factory edit add-secrets-provider openbao ^0"
    Then the command exits with code 0
    And "factory resolve" of the output declares the secrets provider "openbao" at "^0" and still the harness "claude-code" at "^2"

  @id=SCN-FSPEC-080 @status=implemented
  Scenario: Adding the secrets provider at the range it is declared with prints factory.yaml unchanged
    Given a factory.yaml with the secrets provider "env" at "^0" whose agent "triage" has no sandbox and the secrets "[ ref:env/GH_TOKEN ]"
    When the console runs "factory edit add-secrets-provider env ^0"
    Then the command exits with code 0
    And the output is factory.yaml, byte for byte

  @id=SCN-FSPEC-081 @status=implemented
  Scenario: Edit refuses a secrets provider that is declared at another range
    Given a factory.yaml with the secrets provider "env" at "^0" whose agent "triage" has no sandbox and the secrets "[ ref:env/GH_TOKEN ]"
    When the console runs "factory edit add-secrets-provider env ^1"
    Then the command exits with code 1
    And the error is the one line "providers.secrets declares \"env\" at \"^0\", not \"^1\""
    And the output is empty

  @id=SCN-FSPEC-082 @status=implemented
  Scenario: Adding a skill the agent has already prints factory.yaml unchanged
    Given a factory.yaml whose agent "triage" has the skills "./skills/review" and "./skills/testing" written as "[ ./skills/review, ./skills/testing ]"
    When the console runs "factory edit add-skill triage ./skills/review"
    Then the command exits with code 0
    And the output is factory.yaml, byte for byte

  @id=SCN-FSPEC-083 @status=implemented
  Scenario: Removing an egress host the agent does not have prints factory.yaml unchanged
    Given a factory.yaml with the secrets provider "env" at "^0" whose agent "triage" has no sandbox and the secrets "[ ref:env/GH_TOKEN ]"
    When the console runs "factory edit remove-egress triage github.com"
    Then the command exits with code 0
    And the output is factory.yaml, byte for byte

  @id=SCN-FSPEC-084 @status=implemented
  Scenario: Edit refuses a secret reference whose provider is not declared and changes nothing
    Given a factory.yaml with the secrets provider "env" at "^0" whose agent "triage" has no sandbox and the secrets "[ ref:env/GH_TOKEN ]"
    When the console runs "factory edit add-secret triage ref:vault/linear-token"
    Then the command exits with code 1
    And the error is the one line "the edit would make factory.yaml fail \"factory lint\": factory.yaml:13:33 secret \"ref:vault/linear-token\" uses the provider \"vault\", which providers.secrets does not declare"
    And the output is empty
    And factory.yaml in the factory folder is unchanged

  @id=SCN-FSPEC-085 @status=implemented
  Scenario: Edit refuses an egress host for an agent without a sandbox
    Given a factory.yaml with the secrets provider "env" at "^0" whose agent "triage" has no sandbox and the secrets "[ ref:env/GH_TOKEN ]"
    When the console runs "factory edit add-egress triage github.com"
    Then the command exits with code 1
    And the error is the one line "the edit would make factory.yaml fail \"factory lint\": factory.yaml:15:5 /agents/triage/sandbox/template: missing required field"

  @id=SCN-FSPEC-086 @status=implemented
  Scenario: Edit refuses an agent the factory does not declare
    Given a factory.yaml whose agent "triage" has no skills
    When the console runs "factory edit add-skill deploy ./skills/review"
    Then the command exits with code 1
    And the error is the one line "factory.yaml declares no agent \"deploy\""

  @id=SCN-FSPEC-087 @status=implemented
  Scenario: Edit refuses a factory.yaml that does not pass lint and names every problem on one line
    Given a factory.yaml whose agent "triage" names the harness "codex" and the secret "ref:vault/linear-token", neither of them declared
    When the console runs "factory edit add-skill triage ./skills/review"
    Then the command exits with code 1
    And the error is the one line "factory.yaml does not pass \"factory lint\": factory.yaml:8:5 harness \"codex\" is not declared under providers.harness; factory.yaml:11:15 secret \"ref:vault/linear-token\" uses the provider \"vault\", which providers.secrets does not declare"

  @id=SCN-FSPEC-088 @status=implemented
  Scenario: Edit writes a value with YAML syntax in it as one string
    Given a factory.yaml with comments whose agents "triage", "spec" and "review" share the sandbox of "triage" through the anchor "&sandbox"
    When the console runs "factory edit add-egress spec" with the host "evil.example\n      - *sandbox # all: [x]"
    Then the command exits with code 0
    And "factory resolve" of the output gives "spec" the egress hosts "litellm", "github.com" and "evil.example\n      - *sandbox # all: [x]"

  @id=SCN-FSPEC-089 @status=implemented
  Scenario: Edit names its usage for an edit it does not know
    Given a factory.yaml whose agent "triage" has no skills
    When the console runs "factory edit rename-agent triage deploy"
    Then the command exits with code 1
    And the error is the one line "usage: factory edit add-skill|remove-skill|add-secret|remove-secret|add-egress|remove-egress <agent> <value>, or factory edit add-secrets-provider <name> <range>"

  @id=SCN-FSPEC-090 @status=implemented
  Scenario: Edit names its usage when an argument is missing
    Given a factory.yaml whose agent "triage" has no skills
    When the console runs "factory edit add-skill triage"
    Then the command exits with code 1
    And the error is the one line "usage: factory edit add-skill|remove-skill|add-secret|remove-secret|add-egress|remove-egress <agent> <value>, or factory edit add-secrets-provider <name> <range>"

  @id=SCN-FSPEC-094 @status=implemented
  Scenario: Edit keeps an anchor that no alias uses
    Given a factory.yaml whose agent "triage" has the line "skills: &skills [./skills/review]" and the skill folders "skills/review" and "skills/testing"
    When the console runs "factory edit add-skill triage ./skills/testing"
    Then the command exits with code 0
    And the output has the line "skills: &skills [./skills/review, ./skills/testing]" in place of "skills: &skills [./skills/review]"
