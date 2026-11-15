@module=foreman @owner=maintainers
Feature: The person proven to the foreman
  With "FOREMAN_PERSON_KEYS" a signal or a retry whose "by" names a person needs that person's proof in the header
  "OSF-Person", signed by an issuer the setting names, like the console (ADR 0151). The run records the person the
  proof names. "POST /v1/runs" and the events start work and need no proof. Without the setting the API token names
  any person, as before.

  @id=SCN-FORE-171 @status=implemented
  Scenario: A signal with the proof of its person is recorded with the person and the name the proof names
    Given a server with "FOREMAN_PERSON_KEYS" set to the issuer "console", and a run whose stage "implement" runs a turn that waits for "never"
    When "ada@acme.dev" posts the signal "steer" with the message "use the existing date helper" and the display name "Someone else", with the console's proof of "ada@acme.dev" named "Ada", and then the signal "cancel" with its proof
    Then both answers have the status 202
    And "/v1/runs/<id>" shows the state "cancelled" and the actions "steer" and "cancel", each by the person "ada@acme.dev" named "Ada"

  @id=SCN-FORE-172 @status=implemented
  Scenario: A signal with the API token and a made-up person without a proof is refused and changes nothing
    Given a server with "FOREMAN_PERSON_KEYS" set to the issuer "console", and a run whose stage "implement" runs a turn that waits for "never"
    When a caller with the API token posts the signal "cancel" by the person "grace@acme.dev" without "OSF-Person"
    Then the answer has the status 401 and the problem "send OSF-Person: the console's proof of the person (ADR 0151)"
    And "/v1/runs/<id>" still shows the state "running" and no action

  @id=SCN-FORE-173 @status=implemented
  Scenario: A proof past its end, for another module or of an issuer whose key set cannot be read is refused, and one for another path, body or person is refused with 403
    Given a server with "FOREMAN_PERSON_KEYS" set to the issuer "console" and the issuer "backoffice", whose key set answers 500
    When "ada@acme.dev" posts the signal "cancel" to "/v1/runs/run_0a1b2c3d4e5f60718293/signals" with a proof of the console that ended 70 seconds ago, one for "gatekeeper", one for the path of another run, one for another body, one of "grace@acme.dev", and one of "backoffice"
    Then the answers have the status 401 with the end and with the audience "gatekeeper", 403 with the path, the body and the person, and 503 with the issuer "backoffice"
    And the server logged each refusal with its path, the person the proof names and its reason, and no proof

  @id=SCN-FORE-174 @status=implemented
  Scenario: A team's own tool that the setting names proves its person, and a tool that acts as itself needs no proof
    Given a server with "FOREMAN_PERSON_KEYS" set to the issuers "console" and "acme-portal", and a run whose stage "implement" runs a turn that waits for "never"
    When the tool "acme-portal" posts the signal "steer" by "grace@acme.dev" with its own proof named "Grace", then the signal "steer" by the trigger "tool:acme-portal" without a proof, and then the signal "cancel" that names nobody
    Then each answer has the status 202
    And "/v1/runs/<id>" shows the state "cancelled" and the actions "steer" by the person "grace@acme.dev" named "Grace" and "steer" by the trigger "tool:acme-portal"

  @id=SCN-FORE-175 @status=implemented
  Scenario: A retry by a person needs the person's proof, and the new run names the person the proof names
    Given a server with "FOREMAN_PERSON_KEYS" set to the issuer "console" ran the README's "work.json" and the "implement" turn ended with "refusal"
    When "varun@acme.dev" posts a retry of the run without "OSF-Person", and then with the console's proof of "varun@acme.dev" named "Varun"
    Then the first answer has the status 401 and the second the status 201 with a new run retried by the person "varun@acme.dev" named "Varun"

  @id=SCN-FORE-176 @status=implemented
  Scenario: Without "FOREMAN_PERSON_KEYS" the server warns once that the API token names any person, and a malformed setting stops it
    Given the README's factory, committed
    When the user runs "foreman serve" with "FOREMAN_PERSON_KEYS" set to "console", and then without it
    Then the first command exits with code 2 and names the setting and the pair "console"
    And the server without it warned once "FOREMAN_PERSON_KEYS is not set: a caller with FOREMAN_API_TOKEN acts as any person it names (ADR 0151)"

  @id=SCN-FORE-177 @status=implemented
  Scenario: A signal or a retry whose "by" has a kind other than "person" or "trigger" is refused with 400 before the run is looked up
    Given a server with "FOREMAN_PERSON_KEYS" set to the issuer "console"
    When a caller with the API token posts the signal "cancel" and a retry, each by the kind "human" and the made-up person "ada@acme.dev", without "OSF-Person", for a run the server does not know
    Then both answers have the status 400 and a problem that names the kind "human"
