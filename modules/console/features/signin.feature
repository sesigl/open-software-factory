@module=console @owner=maintainers
Feature: Sign-in
  With "CONSOLE_SIGN_IN" the console signs people in itself with OpenID Connect or GitHub (ADR 0134). Who may sign in
  is the access file "access.yaml" beside "factory.yaml", read again at each request; the session is an encrypted
  cookie without the role.

  @id=SCN-CONSOLE-137 @status=implemented @realizes=SCN-FACTORY-RUNTIME-011
  Scenario: A person on the access list signs in and lands on the runs
    Given a console that signs in with OpenID Connect and an access file with "ada@acme.dev" as "admin"
    And the provider signs in "ada@acme.dev"
    When the person opens "/" on 127.0.0.1 and presses "Sign in"
    Then the console sent the person to its address "http://localhost:<port>" and to "/signin"
    And the person lands on "/" with the heading "Runs" and "ada@acme.dev · admin" in the navigation

  @id=SCN-CONSOLE-138 @status=implemented @realizes=SCN-FACTORY-RUNTIME-011
  Scenario: A person who is not on the access list is refused and reads why
    Given a console that signs in with OpenID Connect and an access file with "ada@acme.dev" as "admin"
    And the provider signs in "leo@acme.dev"
    When the person opens "/" and presses "Sign in"
    Then the page answers 403 and says "leo@acme.dev is not on this factory's access list" and where the list lives

  @id=SCN-CONSOLE-139 @status=implemented
  Scenario: An email that the provider did not verify is refused
    Given a console that signs in with OpenID Connect and an access file with "ada@acme.dev" as "admin"
    And the provider signs in "ada@acme.dev" without verifying the email
    When the person opens "/" and presses "Sign in"
    Then the page answers 403 and says "The provider has not verified ada@acme.dev"

  @id=SCN-CONSOLE-140 @status=implemented
  Scenario: After the sign-in the person comes back only to a page of the console
    Given a console that signs in with OpenID Connect and an access file with "ada@acme.dev" as "admin"
    And the provider signs in "ada@acme.dev"
    When the person opens "/signin?next=//evil.example/steal" and presses "Sign in"
    Then the person lands on "/" of the console

  @id=SCN-CONSOLE-141 @status=implemented
  Scenario: Sign out ends the session
    Given a person "ada@acme.dev" signed in to a console that signs in with OpenID Connect
    When the person presses "Sign out" and opens "/" again
    Then the console asks the person to sign in

  @id=SCN-CONSOLE-142 @status=implemented
  Scenario: A session past its end asks to sign in again
    Given a person "ada@acme.dev" signed in to a console whose sessions last 12 hours
    When the console runs 13 hours later and the person opens "/"
    Then the console asks the person to sign in

  @id=SCN-CONSOLE-143 @status=implemented
  Scenario: A session of the previous key stays valid after a second key is added
    Given a person "ada@acme.dev" signed in to a console with the session key "testkit-session-key-1"
    When the console restarts with the keys "testkit-session-key-2,testkit-session-key-1" and the person opens "/"
    Then the person sees the runs

  @id=SCN-CONSOLE-144 @status=implemented @realizes=SCN-FACTORY-RUNTIME-011
  Scenario: A person removed from the access file loses access at the next page
    Given a person "varun@acme.dev" signed in as "member" to a console that signs in with OpenID Connect
    When a merge removes "varun@acme.dev" from the access file and the person opens "/"
    Then the page answers 403 and says "varun@acme.dev is not on this factory's access list"

  @id=SCN-CONSOLE-145 @status=implemented
  Scenario: With the sign-in a form must come from the console's own address
    Given a person "ada@acme.dev" signed in to a console with intake
    When a program sends the form "submit work" with the person's session and the Origin "https://evil.example"
    Then the answer has the status 403 and says "the form came from another site"
    And intake received no submission

  @id=SCN-CONSOLE-146 @status=implemented
  Scenario: The probe "/v1/ready" answers without a session
    Given a console that signs in with OpenID Connect and an access file with "ada@acme.dev" as "admin"
    When a program asks for "/v1/ready" without a session
    Then the answer has the status 200 and the status "ok"

  @id=SCN-CONSOLE-147 @status=implemented
  Scenario: The console with the sign-in does not start without a setting of its provider
    Given a console that signs in with OpenID Connect without "CONSOLE_OIDC_CLIENT_SECRET"
    When the user runs "console serve"
    Then the command exits with code 2
    And it prints "set CONSOLE_OIDC_CLIENT_SECRET: CONSOLE_SIGN_IN=oidc needs it"

  @id=SCN-CONSOLE-149 @status=implemented
  Scenario: The console with the sign-in does not start on an address that is neither loopback nor HTTPS
    Given a console that signs in with OpenID Connect at "CONSOLE_URL" "http://console.acme.dev"
    When the user runs "console serve"
    Then the command exits with code 2
    And it prints "CONSOLE_URL http://console.acme.dev is neither https:// nor loopback"

  @id=SCN-CONSOLE-150 @status=implemented
  Scenario: The console does not start when it signs people in and a sign-in proxy names the person too
    Given a console that signs in with OpenID Connect and has "CONSOLE_USER_HEADER" "X-Forwarded-Email"
    When the user runs "console serve"
    Then the command exits with code 2
    And it prints "set either CONSOLE_SIGN_IN or CONSOLE_USER_HEADER"

  @id=SCN-CONSOLE-148 @status=implemented
  Scenario: A person signs in with GitHub
    Given a console that signs in with GitHub and an access file with "ada@acme.dev" as "admin"
    And GitHub signs in "ada" with the verified primary email "ada@acme.dev"
    When the person opens "/" and presses "Sign in with GitHub"
    Then the person lands on "/" with the heading "Runs" and "ada@acme.dev · admin" in the navigation

  @id=SCN-CONSOLE-154 @status=implemented
  Scenario: Without an access file nobody can sign in, and the page names the file
    Given a console that signs in with OpenID Connect and no access file
    And the provider signs in "ada@acme.dev"
    When the person opens "/" and presses "Sign in"
    Then the page answers 403 and says "Nobody can sign in: <access file>: no such file"

  @id=SCN-CONSOLE-155 @status=implemented
  Scenario: The probe "/v1/ready" answers 503 when the console cannot read its factory
    Given a console whose "CONSOLE_FACTORY" names a file that does not exist
    When a program asks for "/v1/ready"
    Then the answer has the status 503 and the status "failing" with a detail that names the file

  @id=SCN-CONSOLE-156 @status=implemented
  Scenario: With the sign-in a form without a session answers 401
    Given a console that signs in with OpenID Connect and intake
    When a program sends the form "submit work" without a session
    Then the answer has the status 401 and says "sign in first"
    And intake received no submission

  @id=SCN-CONSOLE-165 @status=implemented
  Scenario: A page without a session redirects to the sign-in and comes back to that page
    Given a console that signs in with OpenID Connect and an access file with "ada@acme.dev" as "admin"
    And the provider signs in "ada@acme.dev"
    When the person opens "/factory" and presses "Sign in"
    Then the console first sent the person to "/signin?next=%2Ffactory"
    And the person lands on "/factory" with the heading "acme"

  @id=SCN-CONSOLE-166 @status=implemented
  Scenario: A session before its end stays valid
    Given a person "ada@acme.dev" signed in to a console whose sessions last 12 hours
    When the console runs 11 hours later and the person opens "/"
    Then the person sees the runs

  @id=SCN-CONSOLE-151 @status=implemented
  Scenario: Behind a sign-in proxy with an access file, a person who is not in it gets 403
    Given a console behind a sign-in proxy with "CONSOLE_USER_HEADER" "X-Forwarded-Email" and an access file with "ada@acme.dev" as "admin"
    When the proxy sends "leo@acme.dev" to "/"
    Then the answer has the status 403 and says "leo@acme.dev is not on this factory's access list"

  @id=SCN-CONSOLE-152 @status=implemented
  Scenario: Behind a sign-in proxy with an access file, a person in it sees the runs
    Given a console behind a sign-in proxy with "CONSOLE_USER_HEADER" "X-Forwarded-Email" and an access file with "ada@acme.dev" as "admin"
    When the proxy sends "Ada@acme.dev" to "/"
    Then the page answers 200 with the heading "Runs"

  @id=SCN-CONSOLE-153 @status=implemented
  Scenario: The sign-in page has the look of the design system, served from the console itself
    Given a console that signs in with OpenID Connect and an access file with "ada@acme.dev" as "admin"
    When a person opens "/signin"
    Then the page's stylesheet is a file of the console that answers 200 with "text/css" and names the tokens
    And the console serves the favicon of the design system
