@port=secrets @owner=maintainers
Feature: Store, list and delete the values of secrets, and never print one
  A secrets adapter is a program with the commands put, list, delete, probe and exists (ADR 0137, ADR 0139). put reads the value from
  standard input, never from an argument or a variable, and no command prints a value. A name follows the pattern of
  SecretReference in contracts/, in folders split by "/". The test store is a real store of the adapter's kind with an
  empty folder for each scenario: OpenBao in development mode for the openbao adapter. The write token is the
  console's: it may write, list and delete secrets and read their metadata, but may not read a value. The read token
  is the egress proxy's: it may only read.

  @id=SCN-SECRET-001 @status=implemented @conformance
  Scenario: put stores a value as the first version of a new secret
    Given the test store and the write token
    When the client pipes "lin_test_51c2" into "put linear-token --by ada"
    Then put prints the name "linear-token" and the version 1
    And the test store holds the value "lin_test_51c2" for "linear-token"

  @id=SCN-SECRET-002 @status=implemented @conformance
  Scenario: list names a stored secret with its version, the time and the person of the change
    Given the test store and the write token
    And the client piped "lin_test_51c2" into "put linear-token --by ada"
    When the client runs "list"
    Then list prints one line with the name "linear-token", the version 1, the time of the change and the person "ada"
    And the output does not contain "lin_test_51c2"

  @id=SCN-SECRET-003 @status=implemented @conformance
  Scenario: A second put makes a second version
    Given the test store and the write token
    And the client piped "lin_test_51c2" into "put linear-token --by ada"
    When the client pipes "lin_test_77e4" into "put linear-token --by grace"
    Then put prints the name "linear-token" and the version 2
    And list prints the version 2 and the person "grace" for "linear-token"
    And the test store holds the value "lin_test_77e4" for "linear-token"

  @id=SCN-SECRET-004 @status=implemented @conformance
  Scenario: list walks the folders of the names
    Given the test store and the write token
    And the client piped values into "put team/linear/token --by ada" and "put linear-token --by ada"
    When the client runs "list"
    Then list prints the names "linear-token" and "team/linear/token", in this order

  @id=SCN-SECRET-005 @status=implemented @conformance
  Scenario: delete removes a secret with every version
    Given the test store and the write token
    And the client piped two values into "put linear-token --by ada"
    When the client runs "delete linear-token"
    Then delete prints the name "linear-token" and "deleted" true
    And list prints nothing
    And the test store holds no secret "linear-token"

  @id=SCN-SECRET-006 @status=implemented @conformance
  Scenario: delete of a secret the store does not have says so and succeeds
    Given the test store and the write token
    When the client runs "delete linear-token"
    Then delete prints the name "linear-token" and "deleted" false

  @id=SCN-SECRET-007 @status=implemented @conformance
  Scenario: A secret that another client stored is listed without a person
    Given the test store and the write token
    And another client stored "linear-token" in the test store
    When the client runs "list"
    Then list prints the name "linear-token", the version 1 and the person null

  @id=SCN-SECRET-008 @status=implemented @conformance
  Scenario: put stores the value without its final line break, and keeps the line breaks inside it
    Given the test store and the write token
    When the client pipes "line one", a line break, "line two" and a line break into "put linear-token --by ada"
    Then the test store holds the value "line one", a line break and "line two" for "linear-token"

  @id=SCN-SECRET-009 @status=implemented @conformance
  Scenario: No command prints a value, also when it fails
    Given the test store, the write token and the read token
    When the client pipes "lin_test_51c2" into "put linear-token --by ada", and runs "list", "probe" and "delete linear-token"
    And the client pipes "lin_test_51c2" into "put linear-token --by ada" with the read token, which may not write
    Then no output and no error of these commands contains "lin_test_51c2"

  @id=SCN-SECRET-010 @status=implemented @conformance
  Scenario: The write token cannot read a value
    Given the test store and the write token
    And the client piped "lin_test_51c2" into "put linear-token --by ada"
    When the test reads the value of "linear-token" from the test store with the write token
    Then the test store refuses the read

  @id=SCN-SECRET-011 @status=implemented @conformance
  Scenario: probe says how long the token still lives
    Given the test store and a write token that lives one hour
    When the client runs "probe"
    Then probe prints a "ttl" of at most 3600 seconds and more than 3500, and the time the token expires

  @id=SCN-SECRET-012 @status=implemented @conformance
  Scenario: A name outside the pattern is a usage error before any request
    Given a test store that does not answer
    When the client runs "put ../sys/policy", "put team//token", "put team/./token", "put linear token" and "delete team/" with a value on standard input
    Then each exits with code 2 and the error "name the secret with A-Z, a-z, 0-9, _, . and - in folders split by /, like team/linear-token"

  @id=SCN-SECRET-013 @status=implemented @conformance
  Scenario: An empty value is a usage error
    Given the test store and the write token
    When the client pipes "" into "put linear-token --by ada"
    Then put exits with code 2 and the error "put reads the value from standard input, and it was empty"
    And the test store holds no secret "linear-token"

  @id=SCN-SECRET-014 @status=implemented @conformance
  Scenario: put without the person of the change is a usage error
    Given the test store and the write token
    When the client pipes "lin_test_51c2" into "put linear-token"
    Then put exits with code 2 and the error "name the person of the change, like put linear-token --by ada"

  @id=SCN-SECRET-015 @status=implemented @conformance
  Scenario: Every command says when the store does not answer
    Given a test store that does not answer at "http://127.0.0.1:9"
    When the client runs "put linear-token --by ada" with a value, "list", "delete linear-token" and "probe"
    Then each exits with code 1 and the error "the store at http://127.0.0.1:9 does not answer"

  @id=SCN-SECRET-016 @status=implemented @conformance
  Scenario: A token the store does not know is refused
    Given the test store and the token "osf-test-unknown-token"
    When the client runs "list" and "probe"
    Then each exits with code 1 and the error "the store refused the token"

  @id=SCN-SECRET-017 @status=implemented @conformance
  Scenario: A token without the right names what it may not do
    Given the test store and the read token
    And another client stored "linear-token" in the test store
    When the client pipes "lin_test_51c2" into "put linear-token --by ada", and runs "list" and "delete linear-token"
    Then put exits with code 1 and the error 'the token may not write "linear-token"'
    And list exits with code 1 and the error "the token may not list the secrets"
    And delete exits with code 1 and the error 'the token may not delete "linear-token"'

  @id=SCN-SECRET-018 @status=implemented @conformance
  Scenario: A person over 128 characters or with a line break is a usage error before any request
    Given the test store and the write token
    When the client pipes "lin_test_51c2" into "put linear-token" with a person of 129 characters, and with the person "ada", a line break and "grace"
    And the client pipes "lin_test_51c2" into "put team/longest" with a person of 128 characters
    Then both puts of "linear-token" exit with code 2 and the error "name the person in at most 128 characters, without a line break or another control character"
    And the test store holds no secret "linear-token"
    And put of "team/longest" prints the version 1

  @id=SCN-SECRET-019 @status=implemented @conformance
  Scenario: exists says whether a secret has a value, with the read token, and prints no value
    Given the test store and the read token
    And another client stored "linear-token" with the value "lin_test_51c2" in the test store
    When the client runs "exists linear-token" and "exists team/other-token" with the read token
    Then exists prints the name "linear-token" with "exists" true, and the name "team/other-token" with "exists" false
    And neither output contains "lin_test_51c2"
