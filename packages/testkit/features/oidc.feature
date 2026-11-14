@module=testkit @owner=maintainers
Feature: An OpenID Connect provider
  fakes.oidc is an identity provider in the test process (ADR 0134). It signs in the person a test names, with ID tokens
  on the testkit's clock, so a module's sign-in is tested without a real provider.

  @id=SCN-TK-161 @status=implemented
  Scenario: fakes.oidc signs in the person a test names with a signed ID token on the testkit's clock
    Given a module whose CLI signs in at the provider in "DEMO_ISSUER" with the authorization code flow and PKCE, and prints the state and the claims of the ID token whose signature the provider's keys verify
    And its system test signs in "ada@acme.dev" named "Ada" at fakes.oidc and expects the state, that email as verified, the name, the nonce, the client as audience, the time 2026-01-01T00:00:00Z and a valid signature
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"

  @id=SCN-TK-162 @status=implemented
  Scenario: fakes.oidc refuses a sign-in when the test named nobody
    Given a module whose CLI signs in at the provider in "DEMO_ISSUER" with the authorization code flow and PKCE, and prints the state and the claims of the ID token whose signature the provider's keys verify
    And its system test signs in nobody at fakes.oidc and expects the error "access_denied" with the state
    When the developer runs "testkit run --junit report.xml" in the module
    Then the command exits with code 0
    And "report.xml" has the passed test case "SCN-DEMO-001"
