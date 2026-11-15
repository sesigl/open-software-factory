@module=contracts @owner=maintainers
Feature: Shared formats
  contracts/ holds the formats modules share: factory definition, work item, run record, evidence bundle manifest,
  score, and the events between modules. The TypeSpec sources in typespec/ are the single source; the JSON
  Schemas and @opensoftware/contracts are generated from them. TypeScript is the only client (ADR 0012). "osf-contracts"
  is the CLI of @opensoftware/contracts.

  @id=SCN-CTR-001 @status=implemented @realizes=SCN-FACTORY-CODE-001
  Scenario: A valid factory definition validates
    Given a factory definition "factory.yaml" with the agents "triage" and "implement"
    When the developer runs "osf-contracts validate factory-definition factory.yaml"
    Then the command exits with code 0
    And the output contains "factory.yaml: valid factory-definition"

  @id=SCN-CTR-002 @status=implemented @realizes=SCN-FACTORY-CODE-001
  Scenario: A factory definition with an unknown agent field is rejected with its path
    Given a factory definition "factory.yaml" whose agent "triage" has the unknown field "modle"
    When the developer runs "osf-contracts validate factory-definition factory.yaml"
    Then the command exits with code 1
    And the output contains "factory.yaml /agents/triage/modle: unknown field"

  @id=SCN-CTR-012 @status=implemented
  Scenario: A factory definition with an unknown effort is rejected with the allowed levels
    Given a factory definition "factory.yaml" whose agent "triage" has the effort "huge"
    When the developer runs "osf-contracts validate factory-definition factory.yaml"
    Then the command exits with code 1
    And the output contains "factory.yaml /agents/triage/effort: must be one of \"low\", \"medium\", \"high\", \"xhigh\", \"max\""

  @id=SCN-CTR-003 @status=implemented @realizes=SCN-FACTORY-DATA-001
  Scenario: A run record that names its transcript, artifacts and pull request validates
    Given a run record "run.json" with a transcript URI, two artifact URIs and a pull request URL
    When the developer runs "osf-contracts validate run-record run.json"
    Then the command exits with code 0
    And the output contains "run.json: valid run-record"

  @id=SCN-CTR-004 @status=implemented @realizes=SCN-FACTORY-RUNTIME-008
  Scenario: A run record without a requester is rejected with its path
    Given a run record "run.json" without the attribute "osf.requester.id"
    When the developer runs "osf-contracts validate run-record run.json"
    Then the command exits with code 1
    And the output contains "run.json /resource/osf.requester.id: missing required field"

  @id=SCN-CTR-005 @status=implemented
  Scenario: A breaking change to a released schema fails the compatibility check
    Given the release tag "contracts-v1.0.0" of the contracts
    And a change that removes the agent field "prompt" from the factory definition and sets the version "1.1.0"
    When the developer runs "osf-contracts breaking"
    Then the command exits with code 1
    And the output contains "contracts/factory-definition/factory-definition.schema.json: breaking change since contracts-v1.0.0 without a major version"
    And the output contains "removed property agents.*.prompt"

  @id=SCN-CTR-006 @status=implemented
  Scenario: The generated TypeScript types round-trip every valid fixture
    Given the valid fixtures of every format
    When the developer runs "osf-contracts roundtrip --client typescript"
    Then the command exits with code 0
    And the output names every valid fixture as "unchanged"

  @id=SCN-CTR-007 @status=deprecated
  Scenario: The generated Python client round-trips every valid fixture
    Given the valid fixtures of every format
    When the developer runs "osf-contracts roundtrip --client python"
    Then the command exits with code 0
    And the output names every valid fixture as "unchanged"

  @id=SCN-CTR-008 @status=deprecated
  Scenario: The generated Java client round-trips every valid fixture
    Given the valid fixtures of every format
    When the developer runs "osf-contracts roundtrip --client java"
    Then the command exits with code 0
    And the output names every valid fixture as "unchanged"

  @id=SCN-CTR-009 @status=implemented
  Scenario: A tighter form of a "exactly one of" rule fails the compatibility check
    Given the release tag "contracts-v1.0.0" of the contracts
    And a change that makes "timezone" required for scheduled automations and sets the version "1.1.0"
    When the developer runs "osf-contracts breaking"
    Then the command exits with code 1
    And the output contains "made automations[]|2.timezone required"

  @id=SCN-CTR-013 @status=implemented
  Scenario: An access file with an admin and a member validates
    Given an access file "access.yaml" with "ada@acme.dev" as "admin" and "varun@acme.dev" as "member"
    When the developer runs "osf-contracts validate access access.yaml"
    Then the command exits with code 0
    And the output contains "access.yaml: valid access"

  @id=SCN-CTR-014 @status=implemented
  Scenario: An access file with an unknown role is rejected with the roles it allows
    Given an access file "access.yaml" with "ada@acme.dev" as "owner"
    When the developer runs "osf-contracts validate access access.yaml"
    Then the command exits with code 1
    And the output contains "access.yaml /people/0/role: must be one of \"member\", \"factory-engineer\", \"admin\""

  @id=SCN-CTR-015 @status=implemented
  Scenario: A skill catalog with a skill that one agent lacks the secret of validates
    Given a skill catalog "skills.json" whose skill "release-notes" needs "LINEAR_TOKEN", which the agent "triage" gives with "ref:openbao/linear-token" and the agent "review" lacks
    And whose skill "missing" has no description and no body
    When the developer runs "osf-contracts validate skill-catalog skills.json"
    Then the command exits with code 0
    And the output contains "skills.json: valid skill-catalog"

  @id=SCN-CTR-016 @status=implemented
  Scenario: A skill catalog whose skill has no body is rejected with its path
    Given a skill catalog "skills.json" whose skill "release-notes" has every field but "body"
    When the developer runs "osf-contracts validate skill-catalog skills.json"
    Then the command exits with code 1
    And the output contains "skills.json /skills/0/body: missing required field"

  @id=SCN-CTR-021 @status=implemented
  Scenario: A factory lock with a pinned skill of another repository validates
    Given a factory lock "factory.lock" that pins the skill "review" of "git+https://forge.example/acme/skills.git#v1.2:skills/review" at a commit with its hash
    When the developer runs "osf-contracts validate factory-lock factory.lock"
    Then the command exits with code 0
    And the output contains "factory.lock: valid factory-lock"

  @id=SCN-CTR-022 @status=implemented
  Scenario: A pinned skill with a short commit is rejected with its path
    Given a factory lock "factory.lock" that pins the skill "review" at the commit "4b825dc"
    When the developer runs "osf-contracts validate factory-lock factory.lock"
    Then the command exits with code 1
    And the output contains "factory.lock /skills/review/commit: must match pattern"

  @id=SCN-CTR-023 @status=implemented
  Scenario: The pins of skills in factory.lock are no breaking change
    Given the release tag "contracts-v2.5.0" of the contracts with the factory lock without "skills"
    And the change that adds the optional "skills" to the factory lock and sets the version "2.6.0"
    When the developer runs "osf-contracts breaking"
    Then the command exits with code 0
    And the output contains "no breaking change since contracts-v2.5.0"

  @id=SCN-CTR-024 @status=implemented
  Scenario: A skill catalog with a skill of another repository at its commit validates
    Given a skill catalog "skills.json" whose skill "review" has the source folder "skills/review" of the repository "https://forge.example/acme/skills.git" at a commit
    When the developer runs "osf-contracts validate skill-catalog skills.json"
    Then the command exits with code 0
    And the output contains "skills.json: valid skill-catalog"

  @id=SCN-CTR-025 @status=implemented
  Scenario: A person proof for one call of the foreman validates
    Given a person proof "proof.json" of "ada@acme.dev" with the role "member" for "POST /v1/runs/run_0123456789abcdef0123/signals" of the audience "foreman"
    When the developer runs "osf-contracts validate person-proof proof.json"
    Then the command exits with code 0
    And the output contains "proof.json: valid person-proof"

  @id=SCN-CTR-026 @status=implemented
  Scenario: A person proof without claims is rejected with the path of each required claim
    Given a person proof "proof.json" that is an empty object
    When the developer runs "osf-contracts validate person-proof proof.json"
    Then the command exits with code 1
    And the output names "/iss", "/sub", "/role", "/aud", "/iat", "/exp", "/method", "/path" and "/bodyDigest" each as "missing required field"

  @id=SCN-CTR-027 @status=implemented
  Scenario: A person proof with an unknown role, a method in lower case and a short body digest is rejected with their paths
    Given a person proof "proof.json" of "ada@acme.dev" with the role "owner", the method "post" and the body digest "abc"
    When the developer runs "osf-contracts validate person-proof proof.json"
    Then the command exits with code 1
    And the output contains "proof.json /role: must be one of \"member\", \"factory-engineer\", \"admin\""
    And the output contains "proof.json /method: must match pattern"
    And the output contains "proof.json /bodyDigest: must match pattern"

  @id=SCN-CTR-028 @status=implemented
  Scenario: A key set with one Ed25519 public key validates
    Given a key set "keys.json" with one Ed25519 public key and its thumbprint as "kid"
    When the developer runs "osf-contracts validate person-keys keys.json"
    Then the command exits with code 0
    And the output contains "keys.json: valid person-keys"

  @id=SCN-CTR-029 @status=implemented
  Scenario: A key set whose key holds its private part is rejected with its path
    Given a key set "keys.json" whose Ed25519 key also has the private part "d"
    When the developer runs "osf-contracts validate person-keys keys.json"
    Then the command exits with code 1
    And the output contains "keys.json /keys/0/d: unknown field"

  @id=SCN-CTR-030 @status=implemented
  Scenario: The person proof and its key set are no breaking change
    Given the release tag "contracts-v2.6.0" of the contracts without the formats "person-proof" and "person-keys"
    And the change that adds both formats and sets the version "2.7.0"
    When the developer runs "osf-contracts breaking"
    Then the command exits with code 0
    And the output contains "no breaking change since contracts-v2.6.0"
