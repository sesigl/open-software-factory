@module=testkit @owner=maintainers
Feature: An OpenID Connect provider
  fakes.oidc is an identity provider in the test process (ADR 0134). It signs in the person a test names, with ID tokens
  on the testkit's clock, so a module's sign-in is tested without a real provider.

  @id=SCN-TK-161 @status=implemented
  Scenario: fakes.oidc signs in the person a test names with a signed ID token on the testkit's clock
    Given fakes.oidc that signs in "ada@acme.dev" named "Ada"
    When a module signs in at the provider with the authorization code flow and PKCE, and verifies the ID token with the provider's keys
    Then the module has the state, that email as verified, the name, the nonce, the client as audience, the time 2026-01-01T00:00:00Z and a valid signature

  @id=SCN-TK-162 @status=implemented
  Scenario: fakes.oidc refuses a sign-in when the test named nobody
    Given fakes.oidc that signs in nobody
    When a module signs in at the provider with the authorization code flow and PKCE
    Then the module has the error "access_denied" with the state
