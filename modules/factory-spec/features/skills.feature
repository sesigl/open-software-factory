@module=factory-spec @owner=maintainers
Feature: Lint the skills of a factory
  A skill is a folder with a SKILL.md in the Agent Skills format (agentskills.io, ADR 0140): front matter with the name
  of its folder and a description, then the instructions. Its metadata "opensoftware/secrets" names the secrets it
  needs, by their variables, and "opensoftware/hosts" the hosts, each as one text of names separated by spaces.
  "factory lint" checks every skill an agent uses: its SKILL.md and front matter, the format's limits, files the
  foreman can copy as text, one skill per name, and that the agent declares each secret and allows each host that the
  skill needs. A problem in a skill's file names that file, its line and column.

  @id=SCN-FSPEC-095 @status=implemented
  Scenario: Lint refuses a skill without a description
    Given a factory.yaml whose agent "triage" has the skill "./skills/release-notes"
    And its SKILL.md has the front matter "name: release-notes" and no description
    When the factory engineer runs "factory lint"
    Then the command exits with code 1
    And the output is "skills/release-notes/SKILL.md:2:1 the skill has no description: say what it does and when to use it" and then "factory.yaml: 1 problems"

  @id=SCN-FSPEC-096 @status=implemented @realizes=SCN-FACTORY-CODE-007
  Scenario: Lint names the secret an agent lacks for its skill
    Given the skill "release-notes" whose SKILL.md has the metadata "opensoftware/secrets: LINEAR_TOKEN" and "opensoftware/hosts: api.linear.app"
    And a factory.yaml whose agent "triage" has the skill on line 14, the secret "ref:env/GH_TOKEN" and the egress host "api.linear.app"
    When the factory engineer runs "factory lint"
    Then the command exits with code 1
    And the output is "factory.yaml:14:14 agent \"triage\" lacks the secret LINEAR_TOKEN that its skill \"release-notes\" needs: add a reference such as \"ref:<provider>/linear-token\" to agents.triage.secrets" and then "factory.yaml: 1 problems"

  @id=SCN-FSPEC-097 @status=implemented
  Scenario: Lint names the host an agent's sandbox lacks for its skill
    Given the skill "release-notes" whose SKILL.md has the metadata "opensoftware/secrets: LINEAR_TOKEN" and "opensoftware/hosts: api.linear.app"
    And a factory.yaml whose agent "triage" has the skill on line 14, the secret "ref:env/LINEAR_TOKEN" and only the egress host "github.com"
    When the factory engineer runs "factory lint"
    Then the command exits with code 1
    And the output is "factory.yaml:14:14 agent \"triage\" lacks the host \"api.linear.app\" that its skill \"release-notes\" needs: add it to agents.triage.sandbox.egress" and then "factory.yaml: 1 problems"

  @id=SCN-FSPEC-098 @status=implemented
  Scenario: Lint accepts an agent that declares the secret and the host its skill needs
    Given the skill "release-notes" whose SKILL.md has the metadata "opensoftware/secrets: LINEAR_TOKEN" and "opensoftware/hosts: api.linear.app"
    And a factory.yaml whose agent "triage" has the skill, the secret "ref:openbao/linear-token" and the egress hosts "github.com" and "api.linear.app"
    When the factory engineer runs "factory lint"
    Then the command exits with code 0
    And the output is "factory.yaml: no problems"

  @id=SCN-FSPEC-099 @status=implemented
  Scenario: Lint accepts a SKILL.md with the fields of Claude Code and the metadata of Codex and OpenCode
    Given a factory.yaml whose agent "triage" has the skill "./skills/release-notes"
    And its SKILL.md has a name, a description, a license, a compatibility, "allowed-tools: Bash(git:*) Read", "disable-model-invocation: true" and the metadata "short-description: Release notes" and "opencode/autoinvoke: false"
    When the factory engineer runs "factory lint"
    Then the command exits with code 0
    And the output is "factory.yaml: no problems"

  @id=SCN-FSPEC-100 @status=implemented
  Scenario: Lint asks an agent without a sandbox for no host of its skill
    Given the skill "release-notes" whose SKILL.md has the metadata "opensoftware/secrets: LINEAR_TOKEN" and "opensoftware/hosts: api.linear.app"
    And a factory.yaml whose agent "triage" has the skill, the secret "ref:env/LINEAR_TOKEN" and no sandbox
    When the factory engineer runs "factory lint"
    Then the command exits with code 0
    And the output is "factory.yaml: no problems"

  @id=SCN-FSPEC-101 @status=implemented
  Scenario: Lint names a skill folder without a SKILL.md
    Given a factory.yaml whose agent "triage" has the skill "./skills/release-notes" on line 14
    And the folder "skills/release-notes" holds only "README.md"
    When the factory engineer runs "factory lint"
    Then the command exits with code 1
    And the output is "factory.yaml:14:14 the skill \"./skills/release-notes\" has no SKILL.md" and then "factory.yaml: 1 problems"

  @id=SCN-FSPEC-102 @status=implemented
  Scenario: Lint names a SKILL.md without front matter
    Given a factory.yaml whose agent "triage" has the skill "./skills/release-notes"
    And its SKILL.md is "# Release notes"
    When the factory engineer runs "factory lint"
    Then the command exits with code 1
    And the output is "skills/release-notes/SKILL.md:1:1 SKILL.md has no front matter: it starts with a line \"---\", the fields name and description and a line \"---\"" and then "factory.yaml: 1 problems"

  @id=SCN-FSPEC-103 @status=implemented
  Scenario: Lint names the line of front matter that does not parse, and a front matter that is no mapping
    Given a factory.yaml whose agent "triage" has the skills "./skills/release-notes" and "./skills/changelog"
    And the SKILL.md of "release-notes" repeats the key "name" on line 3
    And the front matter of "changelog" is the list "- changelog"
    When the factory engineer runs "factory lint"
    Then the command exits with code 1
    And the output is "skills/release-notes/SKILL.md:3:1 Map keys must be unique", "skills/changelog/SKILL.md:2:1 the skill has no name: write \"name: changelog\", the name of its folder", "skills/changelog/SKILL.md:2:1 the skill has no description: say what it does and when to use it" and then "factory.yaml: 3 problems"

  @id=SCN-FSPEC-104 @status=implemented
  Scenario: Lint names each name the format does not allow
    Given a factory.yaml whose agent "triage" has the skills "./skills/Release-Notes", "./skills/-notes", "./skills/release--notes" and "./skills/release_notes"
    And each SKILL.md has the name of its folder on line 2
    When the factory engineer runs "factory lint"
    Then the command exits with code 1
    And the output names, for each of the four, "SKILL.md:2:1 name \"<name>\" is not lowercase letters and digits with single hyphens between them" and then "factory.yaml: 4 problems"

  @id=SCN-FSPEC-105 @status=implemented
  Scenario: Lint names a skill whose name is not the name of its folder
    Given a factory.yaml whose agent "triage" has the skill "./skills/release-notes"
    And its SKILL.md has the name "changelog" on line 2
    When the factory engineer runs "factory lint"
    Then the command exits with code 1
    And the output is "skills/release-notes/SKILL.md:2:1 name \"changelog\" is not \"release-notes\", the name of its folder" and then "factory.yaml: 1 problems"

  @id=SCN-FSPEC-106 @status=implemented
  Scenario: Lint accepts a name, a description and a compatibility at the format's limits and names each over them
    Given a factory.yaml whose agent "triage" has a skill with a name of 64 characters, a description of 1024 and a compatibility of 500
    And a skill with a name of 65 characters, a description of 1025 and a compatibility of 501
    When the factory engineer runs "factory lint"
    Then the command exits with code 1
    And the output is "name has 65 characters, more than the 64 the format allows", "description has 1025 characters, more than the 1024 the format allows" and "compatibility has 501 characters, more than the 500 the format allows" in the second SKILL.md, and then "factory.yaml: 3 problems"

  @id=SCN-FSPEC-107 @status=implemented
  Scenario: Lint names metadata that is no mapping and needs it cannot read
    Given a factory.yaml whose agent "triage" has the skills "./skills/notes", "./skills/hosts" and "./skills/names"
    And the metadata of "notes" is the text "LINEAR_TOKEN"
    And the metadata "opensoftware/hosts" of "hosts" is a list on line 5
    And the metadata of "names" has "opensoftware/secrets: linear-token" on line 5 and "opensoftware/hosts: https://api.linear.app" on line 6
    When the factory engineer runs "factory lint"
    Then the command exits with code 1
    And the output is "skills/notes/SKILL.md:4:1 metadata is no mapping of keys to text", "skills/hosts/SKILL.md:5:3 metadata \"opensoftware/hosts\" is no text: write the names on one line, separated by spaces", "skills/names/SKILL.md:5:3 metadata \"opensoftware/secrets\" names \"linear-token\", which is no variable of upper-case letters, digits and \"_\"", "skills/names/SKILL.md:6:3 metadata \"opensoftware/hosts\" names \"https://api.linear.app\", which is no host name" and then "factory.yaml: 4 problems"

  @id=SCN-FSPEC-108 @status=implemented
  Scenario: Lint warns about a SKILL.md of 500 lines and accepts one of 499
    Given a factory.yaml whose agent "triage" has the skills "./skills/short" with a SKILL.md of 499 lines and "./skills/long" with one of 500
    When the factory engineer runs "factory lint"
    Then the command exits with code 0
    And the output is "skills/long/SKILL.md:1:1 warning: SKILL.md has 500 lines; the format asks for fewer than 500, with the details in files beside it" and then "factory.yaml: no problems, 1 warning"

  @id=SCN-FSPEC-109 @status=implemented
  Scenario: Lint refuses a skill with a file that is not UTF-8 text
    Given a factory.yaml whose agent "triage" has the skill "./skills/release-notes"
    And the skill has the file "assets/logo.png" with the bytes of a PNG image and the file "assets/template.md" with text
    When the factory engineer runs "factory lint"
    Then the command exits with code 1
    And the output is "skills/release-notes/assets/logo.png:1:1 the file is not UTF-8 text: the foreman copies a skill's files as text, so keep binary files out of the skill" and then "factory.yaml: 1 problems"

  @id=SCN-FSPEC-110 @status=implemented
  Scenario: Lint refuses two skills with one name and accepts one skill for two agents
    Given a factory.yaml whose agents "triage" and "spec" have the skill "./skills/release-notes", written as "skills/release-notes/" for "spec"
    And whose agent "review" has the skill "./shared/release-notes" on line 23
    When the factory engineer runs "factory lint"
    Then the command exits with code 1
    And the output is "factory.yaml:23:14 the skill \"./shared/release-notes\" has the name \"release-notes\" of the skill \"./skills/release-notes\": a factory uses one skill of a name" and then "factory.yaml: 1 problems"

  @id=SCN-FSPEC-111 @status=implemented
  Scenario: Edit refuses a skill whose secret the agent lacks and names it
    Given the skill "release-notes" whose SKILL.md has the metadata "opensoftware/secrets: LINEAR_TOKEN" and "opensoftware/hosts: api.linear.app"
    And a factory.yaml with the secrets provider "env" at "^0" whose agent "triage" has no sandbox and the secrets "[ ref:env/GH_TOKEN ]"
    When the console runs "factory edit add-skill triage ./skills/release-notes"
    Then the command exits with code 1
    And the error is the one line "the edit would make factory.yaml fail \"factory lint\": factory.yaml:16:9 agent \"triage\" lacks the secret LINEAR_TOKEN that its skill \"release-notes\" needs: add a reference such as \"ref:<provider>/linear-token\" to agents.triage.secrets"
    And the output is empty

  @id=SCN-FSPEC-112 @status=implemented
  Scenario: Lint names a skill path that is no folder
    Given a factory.yaml whose agent "triage" has the skills "./skills/missing" and "./skills/notes.md" on line 14
    And the factory folder has no "skills/missing" and has the file "skills/notes.md"
    When the factory engineer runs "factory lint"
    Then the command exits with code 1
    And the output is "factory.yaml:14:14 the skill \"./skills/missing\" has no SKILL.md", "factory.yaml:14:32 the skill \"./skills/notes.md\" has no SKILL.md" and then "factory.yaml: 2 problems"

  @id=SCN-FSPEC-113 @status=implemented
  Scenario: Lint names a SKILL.md whose front matter is not closed or does not start on its first line
    Given a factory.yaml whose agent "triage" has the skills "./skills/open" and "./skills/late"
    And the SKILL.md of "open" starts with a line "---" and has no second one
    And the SKILL.md of "late" starts with "# Late" and has its front matter below it
    When the factory engineer runs "factory lint"
    Then the command exits with code 1
    And the output names "skills/open/SKILL.md:1:1" and "skills/late/SKILL.md:1:1", each with "SKILL.md has no front matter: it starts with a line \"---\", the fields name and description and a line \"---\"", and then "factory.yaml: 2 problems"

  @id=SCN-FSPEC-114 @status=implemented
  Scenario: Lint names a SKILL.md that is not UTF-8 text once
    Given a factory.yaml whose agent "triage" has the skill "./skills/release-notes"
    And its SKILL.md is valid but written in Latin-1, with the description "Notes for the café team."
    When the factory engineer runs "factory lint"
    Then the command exits with code 1
    And the output is "skills/release-notes/SKILL.md:1:1 the file is not UTF-8 text: the foreman copies a skill's files as text, so keep binary files out of the skill" and then "factory.yaml: 1 problems"
