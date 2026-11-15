@module=intake @owner=maintainers
Feature: The person, proven
  With "INTAKE_PERSON_KEYS", a submission to "/v1/work-items" whose requester is a person needs the proof of that
  person in the header "OSF-Person", signed by an issuer of the setting, like the console (ADR 0151). The server
  records the person the proof names. A requester of the kind "trigger" needs no proof, and without the setting the
  server works as before.

  @id=SCN-INTAKE-067 @status=implemented
  Scenario: A work item submitted with the console's proof of the person is recorded with that person and the proof's name
    Given the server runs with "INTAKE_PERSON_KEYS" set to the key set of the console
    When the console posts the README's "work.json" with the requester "ada@acme.dev" named "Ada" and its proof of "ada@acme.dev" named "Ada Lovelace"
    Then the answer has the status 201
    And "/v1/work-items/<id>" shows the requester "ada@acme.dev" with the name "Ada Lovelace" of the proof

  @id=SCN-INTAKE-068 @status=implemented
  Scenario: A call with the API token that names a made-up person without a proof is refused and makes no work item
    Given the server runs with "INTAKE_PERSON_KEYS" set to the key set of the console
    When a program posts the README's "work.json" with the API token and the requester "grace@acme.dev" without "OSF-Person"
    Then the answer has the status 401 and the problem "Unauthorized" with the detail "send OSF-Person: the console's proof of the person (ADR 0151)"
    And "/v1/work-items?dedupeKey=idea:export-csv" answers 404

  @id=SCN-INTAKE-069 @status=implemented
  Scenario: A proof past its end is refused with its end, and the log names the person but not the proof
    Given the server runs at "2026-01-01T00:00:41Z" with "INTAKE_PERSON_KEYS" set to the key set of the console
    When the console posts the README's "work.json" with the requester "ada@acme.dev" and its proof of "ada@acme.dev" that ended at "2026-01-01T00:00:30Z"
    Then the answer has the status 401 and the detail "the person proof ended at 2026-01-01T00:00:30Z"
    And the error output names "ada@acme.dev" and the reason, and does not hold the proof

  @id=SCN-INTAKE-070 @status=implemented
  Scenario: A proof for another module, another path, another body or another person is refused with the claim that differs
    Given the server runs with "INTAKE_PERSON_KEYS" set to the key set of the console
    When the console posts the README's "work.json" with the requester "ada@acme.dev" and a proof of "ada@acme.dev" for "foreman", for the path "/v1/runs", for another body, and of "grace@acme.dev"
    Then the answers are 401 for the audience "foreman" and 403 for the path, the body digest and the person, each with the claim
    And "/v1/work-items?dedupeKey=idea:export-csv" answers 404

  @id=SCN-INTAKE-071 @status=implemented @realizes=SCN-FACTORY-ACCESS-002
  Scenario: A team's tool whose key set is in the setting proves the person it signed in, a tool outside the setting is refused
    Given the server runs with "INTAKE_PERSON_KEYS" set to the key sets of the console and of the tool "acme-portal"
    When "acme-portal" posts the README's "work.json" with its proof of "varun@acme.dev", and "other-portal" posts it with its proof of "grace@acme.dev"
    Then the answer to "acme-portal" has the status 201 and the work item's requester is "varun@acme.dev"
    And the answer to "other-portal" has the status 401 and a detail that names the issuer "other-portal"

  @id=SCN-INTAKE-072 @status=implemented @realizes=SCN-FACTORY-ACCESS-002
  Scenario: A team's tool that names itself as a trigger submits work without a proof
    Given the server runs with "INTAKE_PERSON_KEYS" set to the key set of the console
    When a program posts the README's "work.json" with the API token and the requester of the kind "trigger" "tool:acme-portal"
    Then the answer has the status 201
    And "/v1/work-items/<id>" shows the requester of the kind "trigger" "tool:acme-portal"

  @id=SCN-INTAKE-073 @status=implemented @realizes=SCN-FACTORY-ACCESS-001 @replaces=SCN-INTAKE-017
  Scenario: A local agent submits work through the Factory MCP server as the trigger of its requester
    Given the server runs with "INTAKE_PERSON_KEYS" set to the key set of the console and "intake mcp" is connected to it as "github:varun"
    When the agent calls the tool "submit_work" with the title "Export reports as CSV"
    Then the tool answers a work item in the state "received"
    And "/v1/work-items/<id>" shows the requester of the kind "trigger" "mcp:github:varun" and the origin "mcp"

  @id=SCN-INTAKE-074 @status=implemented
  Scenario: A setting of the issuers that is no list of name=url pairs stops the server with code 2 and names the variable
    Given an empty working folder
    When the user runs "intake serve" with "INTAKE_PERSON_KEYS" set to "console"
    Then the command exits with code 2
    And the error output says "INTAKE_PERSON_KEYS: a key set is <name>=<url>, like console=http://console:8080/.well-known/jwks.json: "console" is not"

  @id=SCN-INTAKE-075 @status=implemented
  Scenario: A server without the setting takes any person from a caller with the API token and says so once at its start
    Given the server runs without "INTAKE_PERSON_KEYS"
    When a program posts the README's "work.json" with the API token and the requester "grace@acme.dev" without "OSF-Person"
    Then the answer has the status 201
    And the error output says once "INTAKE_PERSON_KEYS is not set: a caller with the API token names any person (ADR 0151)"

  @id=SCN-INTAKE-076 @status=implemented
  Scenario: A key set that cannot be fetched answers 503 and names its issuer
    Given the server runs with "INTAKE_PERSON_KEYS" set to "console=<url>", where the key set answers 500
    When the console posts the README's "work.json" with the requester "ada@acme.dev" and its proof of "ada@acme.dev"
    Then the answer has the status 503 and a detail that names the issuer "console" and "HTTP 500"
