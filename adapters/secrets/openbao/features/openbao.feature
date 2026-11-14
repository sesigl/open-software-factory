@module=secrets-openbao @owner=maintainers
Feature: The policies, the mount and the limits of secrets-openbao
  secrets-openbao passes the secrets port's scenarios in ports/secrets/features/. These scenarios cover what is
  OpenBao's own: the two policies it prints for the factory's mount, a mount that is no KV version 2 mount, OpenBao's
  request limit and the variables it needs (ADR 0137). The test store is the testkit's OpenBao in development mode,
  with a KV version 2 mount for each scenario.

  @id=SCN-SOPENBAO-001 @status=implemented
  Scenario: policy write and policy read print the two policies of the mount "secret" by default
    Given no variable "OSF_OPENBAO_MOUNT"
    When the client runs "policy write" and "policy read"
    Then policy write prints "create" and "update" on "secret/data/*", and "read", "list", "update" and "delete" on "secret/metadata/*"
    And policy read prints "read" on "secret/data/*" and on "secret/metadata/*"

  @id=SCN-SOPENBAO-002 @status=implemented
  Scenario: The token of policy read reads a value and its metadata
    Given the test store, the write token and a token with the policy that "policy read" prints
    And the client piped "lin_test_51c2" into "put linear-token --by ada"
    When the test reads "linear-token" and its metadata from OpenBao with the read token
    Then OpenBao answers the value "lin_test_51c2" and the metadata with the person "ada"

  @id=SCN-SOPENBAO-003 @status=implemented
  Scenario: A mount that is no KV version 2 mount of the token is refused
    Given the test store and the write token
    When the client runs "probe" and pipes a value into "put linear-token --by ada" with the mount "cubbyhole", and runs "probe" with the mount "missing"
    Then each exits with code 1 and the error 'OpenBao has no KV version 2 mount "<mount>" that the token may use' for its mount

  @id=SCN-SOPENBAO-004 @status=implemented
  Scenario: A value over OpenBao's request limit is refused and not stored
    Given the test store and the write token
    When the client pipes a value of 33 MiB into "put linear-token --by ada"
    Then put exits with code 1 and an error that starts with "OpenBao answered POST" and names the status 413
    And the test store holds no secret "linear-token"

  @id=SCN-SOPENBAO-005 @status=implemented
  Scenario: A command without OpenBao's address or token is a usage error
    When the client runs "list" without "OSF_OPENBAO_ADDR", and "list" without "OSF_OPENBAO_TOKEN"
    Then the first exits with code 2 and the error "set OSF_OPENBAO_ADDR to OpenBao's address, like http://127.0.0.1:8200"
    And the second exits with code 2 and the error "set OSF_OPENBAO_TOKEN to an OpenBao token"

  @id=SCN-SOPENBAO-006 @status=implemented
  Scenario: policy without write or read is a usage error
    When the client runs "policy" and "policy admin"
    Then each exits with code 2 and the error "name the policy, like policy write or policy read"

  @id=SCN-SOPENBAO-007 @status=implemented
  Scenario: An address with a final slash reaches OpenBao
    Given the test store and the write token
    When the client runs "probe" with the store's address and a final "/"
    Then probe exits with code 0

  @id=SCN-SOPENBAO-008 @status=implemented
  Scenario: A command with an argument too many shows the usage
    When the client runs "delete linear-token team/linear-token"
    Then delete exits with code 2 and prints the usage on standard error

  @id=SCN-SOPENBAO-009 @status=planned
  Scenario: exists says false for a secret whose current version another client deleted or destroyed
    Given the test store and the read token
    And another client stored "deleted-token" and "destroyed-token", then deleted the current version of the first and destroyed that of the second
    When the client runs "exists deleted-token" and "exists destroyed-token" with the read token
    Then exists prints "exists" false for both

  @id=SCN-SOPENBAO-010 @status=planned
  Scenario: exists with a token that may not read the metadata names what it may not do
    Given the test store and a token whose policy may only write values
    When the client runs "exists linear-token" with that token
    Then exists exits with code 1 and the error 'the token may not read "linear-token"'
