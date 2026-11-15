@module=console @owner=maintainers
Feature: Secrets
  The page "/secrets" lists the secrets that the factory's agents declare and the names in the secret store, and an
  admin stores and deletes values there (ADR 0137). The console runs the secrets port's adapter in
  "CONSOLE_SECRETS_ADAPTER" and gives it a value only on its standard input; no page, answer or line it prints holds a
  value. The store is OpenBao at "OSF_OPENBAO_ADDR". Only a person with the role "admin" opens the page.

  @id=SCN-CONSOLE-173 @status=implemented
  Scenario: An admin stores a value for a missing secret, and the list says "Set" with the person
    Given a factory whose agent "triage" declares "ref:openbao/linear-token", a store without it, and a console behind a sign-in proxy with "ada@acme.dev" as "admin"
    When "ada@acme.dev" opens "/secrets", types a value for "linear-token" and presses "Store value"
    Then the console answered 303 to "/secrets"
    And the list says "linear-token" is "Set", "Used by the agent triage · version 1, set by ada@acme.dev on <time>"
    And the store holds the value as version 1 of "linear-token"

  @id=SCN-CONSOLE-174 @status=implemented
  Scenario: A declared secret without a value says "Missing" and names the agents that need it
    Given a factory whose agents "triage" and "review" declare "ref:openbao/linear-token" and may reach "api.linear.app", and a store without it
    When the admin opens "/secrets"
    Then the list says "linear-token" is "Missing", "Needed by the agents review and triage"
    And the navigation's link "Secrets" is the current page and says "1 missing"
    And the form "Store a value" is for "linear-token", with a password field "Value" that the browser does not fill, and says that the value is sent only to "api.linear.app"

  @id=SCN-CONSOLE-175 @status=implemented
  Scenario: A stored secret that no agent declares says "Not used" and offers "Delete"
    Given a factory whose agents declare no secret, and a store in which another program stored "sentry-token"
    When the admin opens "/secrets"
    Then the list says "sentry-token" is "Not used", "No agent declares it · version 1, set on <time>"
    And its link "Delete sentry-token" leads to "/secrets/delete?name=sentry-token"
    And the form "Store a value" names no secret and says "Sent only to the hosts of the agents that declare it."

  @id=SCN-CONSOLE-176 @status=implemented
  Scenario: The secrets of the providers "env" and "file" are listed as set outside the UI
    Given a factory whose agent "ship" declares "ref:env/GH_TOKEN" and "ref:file/linear-token", and an empty store
    When the admin opens "/secrets"
    Then the list says "GH_TOKEN" is "Set outside the UI", "Used by the agent ship · from the variable OSF_SECRET_GH_TOKEN of the sandbox adapter"
    And it says "linear-token" is "Set outside the UI", "Used by the agent ship · from the file linear-token in OSF_SECRETS_DIR of the sandbox adapter"
    And the page says when a new value takes effect, that it goes only to the hosts the agent may reach, and that a secret outside an HTTP request does not work this way

  @id=SCN-CONSOLE-177 @status=implemented
  Scenario: A member gets 403 for "/secrets" and its form, and only an admin's navigation links "Secrets"
    Given a console behind a sign-in proxy with an access file with "ada@acme.dev" as "admin" and "varun@acme.dev" as "member", and a store
    When "varun@acme.dev" opens "/secrets" and "/", and sends the form "Store value", and "ada@acme.dev" opens "/"
    Then the page and the form answer 403 and say "varun@acme.dev has the role member: Secrets needs the role admin"
    And the navigation of "varun@acme.dev" does not link "Secrets", and the navigation of "ada@acme.dev" links "/secrets"
    And the store holds no value of "linear-token"

  @id=SCN-CONSOLE-178 @status=implemented
  Scenario: In the open mode "/secrets" and its form answer 404
    Given a console without "CONSOLE_SIGN_IN" and "CONSOLE_USER_HEADER", and a store
    When a person opens "/secrets" and a program sends the form "Store value"
    Then both answer 404 and say "no secrets: they need a person with the role admin, so set CONSOLE_SIGN_IN, or an access file with CONSOLE_USER_HEADER"

  @id=SCN-CONSOLE-179 @status=implemented
  Scenario: Behind a sign-in proxy without an access file "/secrets" answers 404, and the navigation does not link it
    Given a console behind a sign-in proxy with "CONSOLE_USER_HEADER" "X-Forwarded-Email" and no access file, and a store
    When the proxy sends "ada@acme.dev" to "/secrets" and to "/"
    Then "/secrets" answers 404 and says "no secrets: they need a person with the role admin, so set CONSOLE_SIGN_IN, or an access file with CONSOLE_USER_HEADER"
    And the navigation of "/" does not link "Secrets"

  @id=SCN-CONSOLE-180 @status=implemented
  Scenario: Without a store "/secrets" answers 404 and names the variable
    Given a console behind a sign-in proxy with "ada@acme.dev" as "admin" and without "OSF_OPENBAO_ADDR"
    When "ada@acme.dev" opens "/secrets"
    Then the page answers 404 and says "no secret store: set OSF_OPENBAO_ADDR and OSF_OPENBAO_TOKEN to the factory's OpenBao"

  @id=SCN-CONSOLE-181 @status=implemented
  Scenario: A stored value is in no output of the console
    Given a factory whose agent "triage" declares "ref:openbao/linear-token", a store without it, and a console behind a sign-in proxy with "ada@acme.dev" as "admin"
    When "ada@acme.dev" opens "/secrets", stores a value for "linear-token", opens the page it is sent to, and sends the same value for the name "team/../linear-token" and in a form over 64 KiB
    Then the store holds the value for "linear-token"
    And no page, header or redirect that the console answered and nothing that it printed holds the value

  @id=SCN-CONSOLE-182 @status=implemented
  Scenario: A name that the store's adapter refuses answers 400 and names the problem
    Given a factory whose agent "triage" declares "ref:openbao/linear-token", a store without it, and a console behind a sign-in proxy with "ada@acme.dev" as "admin"
    When "ada@acme.dev" sends a value for the name "team/../linear-token"
    Then the page answers 400 and says "Not stored: name the secret with A-Z, a-z, 0-9, _, . and - in folders split by /, like team/linear-token"
    And the form "Store a value" is for "team/../linear-token" again, its field "Value" is empty, and it says "Sent to no host: no agent that declares it may reach one."
    And the list still says "linear-token" is "Missing"

  @id=SCN-CONSOLE-183 @status=implemented
  Scenario: A form over 64 KiB answers 413 and stores nothing
    Given a factory whose agent "triage" declares "ref:openbao/linear-token", a store without it, and a console behind a sign-in proxy with "ada@acme.dev" as "admin"
    When "ada@acme.dev" sends a value of 70000 characters for "linear-token"
    Then the page answers 413 and says "Not stored: the form is over its limit of 64 KiB"
    And the store holds no value of "linear-token"

  @id=SCN-CONSOLE-184 @status=implemented
  Scenario: "Delete" asks first on a page of its own, then removes the secret
    Given a factory whose agents declare no secret, and a store in which another program stored "sentry-token"
    When the admin follows "Delete sentry-token" on "/secrets" and presses "Delete" on the page that asks
    Then the page that asked has the heading "Delete sentry-token?" and the link "Cancel" to "/secrets"
    And the console answered 303 to "/secrets", which says "No secrets yet"
    And the store holds no value of "sentry-token"

  @id=SCN-CONSOLE-185 @status=implemented
  Scenario: A store that does not answer is named on "/secrets", and its secrets say "Unknown"
    Given a factory whose agent "triage" declares "ref:openbao/linear-token", and "OSF_OPENBAO_ADDR" names a port where nothing listens
    When the admin opens "/secrets"
    Then the page says "The secrets could not be listed: the store at <address> does not answer"
    And the list says "linear-token" is "Unknown", "Needed by the agent triage"

  @id=SCN-CONSOLE-186 @status=implemented
  Scenario: "console doctor" names each secret of OpenBao that the factory declares without a value
    Given a factory whose agent "triage" declares "ref:openbao/linear-token" and whose agent "review" declares "ref:openbao/sentry-token", and a store with only "linear-token"
    When the user runs "console doctor"
    Then the command exits with code 1
    And it prints "ok    secrets", "ok    secrets token" and "ok    secret linear-token"
    And it prints "FAIL  secret sentry-token: no value in the store for the agent review: store one on /secrets"

  @id=SCN-CONSOLE-187 @status=implemented
  Scenario: "console doctor" names a store that does not answer
    Given a factory whose agent "triage" declares "ref:openbao/linear-token", and "OSF_OPENBAO_ADDR" names a port where nothing listens
    When the user runs "console doctor"
    Then the command exits with code 1
    And it prints "FAIL  secrets: the store at <address> does not answer: check OSF_OPENBAO_ADDR, OSF_OPENBAO_TOKEN and CONSOLE_SECRETS_ADAPTER"

  @id=SCN-CONSOLE-188 @status=implemented
  Scenario: "console doctor" and "/health" warn when the console's token for the store ends within 7 days
    Given a factory whose agent "triage" declares "ref:openbao/linear-token", a store with it, and a console's token that lives 72 hours
    When the user runs "console doctor" and a person opens "/health"
    Then the command exits with code 0 and prints "WARN  secrets token: the token in OSF_OPENBAO_TOKEN ends at <time>, within 7 days: give the console a new token"
    And its last line is "all 5 checks ok, warnings: 1"
    And "/health" answers 200 with the row "secrets token", "warning" and the same advice

  @id=SCN-CONSOLE-189 @status=implemented @kind=journey
  Scenario: An admin signs in and stores a secret (journey)
    Given a console that signs in with OpenID Connect, an access file with "ada@acme.dev" as "admin", and a factory whose agent "triage" declares "ref:openbao/linear-token" without a value in the store
    And the provider signs in "ada@acme.dev"
    When the person signs in in Chromium, follows "Secrets", types a value for "linear-token" and presses "Store value"
    Then the person sees "linear-token" as "Set" by "ada@acme.dev"
    And the page passes the accessibility checks, and its screenshot is kept as "secrets"
