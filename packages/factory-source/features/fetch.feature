@module=factory-source @owner=maintainers
Feature: A factory's folder from a path or a Git remote
  factorySource gives the folder of a factory: the folder of a path, or the files of the commit of a ref of a Git
  remote, fetched into a cache, with a token for a private remote (ADR 0124, ADR 0142).

  @id=SCN-FSOURCE-001 @status=implemented
  Scenario: A factory in a Git remote gives the files of the commit of its ref
    Given a "factory.yaml" is committed on the branch "main" of a Git repository at a "file://" URL
    When a program fetches the source "git+<url>#main" with a cache folder
    Then it gets the commit of "main", the folder "<cache>/<commit>" and its "factory.yaml" with its text

  @id=SCN-FSOURCE-002 @status=implemented
  Scenario: A remote without a ref gives the commit of its HEAD
    Given a "factory.yaml" is committed on the branch "main" of a Git repository at a "file://" URL, tagged "v1"
    And "main" has a newer commit after "v1"
    When a program fetches the source "git+<url>" with a cache folder
    Then it gets the newer commit of "main", the remote's HEAD

  @id=SCN-FSOURCE-003 @status=implemented
  Scenario: A ref that the remote does not have is a FetchError with Git's message
    Given a "factory.yaml" is committed on the branch "main" of a Git repository at a "file://" URL
    When a program fetches the source "git+<url>#no-such-branch" with a cache folder
    Then the fetch fails with a FetchError "cannot fetch no-such-branch of file://<path>: " and Git's message "couldn't find remote ref no-such-branch"

  @id=SCN-FSOURCE-004 @status=implemented
  Scenario: A path gives its file and its folder, with no commit and nothing in the cache
    Given the file "factory/hello.yaml" that is not committed
    When a program fetches the source "<path of factory/hello.yaml>" with a cache folder
    Then it gets the folder "factory", the file "factory/hello.yaml" and no commit
    And the cache folder holds nothing

  @id=SCN-FSOURCE-005 @status=implemented
  Scenario: A new commit on the ref gives a new folder, and the folder of the old commit stays as it was
    Given a "factory.yaml" is committed on the branch "main" of a Git repository at a "file://" URL
    And a program fetched the source "git+<url>#main" with a cache folder
    When "factory.yaml" changes in a new commit on "main" and the program fetches the same source again
    Then it gets the new commit and its folder with the new text
    And the folder of the first commit still holds the first text

  @id=SCN-FSOURCE-006 @status=implemented
  Scenario: A folder that a stopped fetch left half written is written again from nothing
    Given a "factory.yaml" is committed on the branch "main" of a Git repository at a "file://" URL
    And the cache folder holds "<commit>.partial/stale.txt", as a fetch that stopped leaves it
    When a program fetches the source "git+<url>#main" with that cache folder
    Then the folder "<cache>/<commit>" holds "factory.yaml" and no "stale.txt"
    And the cache folder holds no "<commit>.partial"

  @id=SCN-FSOURCE-007 @status=implemented
  Scenario: Two fetches at once of one source both give the folder of the commit
    Given a "factory.yaml" is committed on the branch "main" of a Git repository at a "file://" URL
    When a program starts two fetches of the source "git+<url>#main" with one cache folder at once
    Then both give the commit of "main" and the folder "<cache>/<commit>" with its "factory.yaml"

  @id=SCN-FSOURCE-008 @status=implemented
  Scenario: A remote over HTTP gets the token as Git's Basic credentials, and no file of the cache holds it
    Given a forge over HTTP whose repository "/acme/factory.git" asks for credentials
    When a program fetches the source "git+<url>/acme/factory.git#main" with a cache folder and the token "factory-token-0001"
    Then the forge received "Authorization: Basic" with the base64 of "x-access-token:factory-token-0001"
    And the fetch fails with a FetchError that names the URL and not the token
    And no file below the cache folder holds the token

  @id=SCN-FSOURCE-009 @status=implemented
  Scenario: A private remote without the token is a FetchError at once, with no prompt for a password
    Given a forge over HTTP whose repository "/acme/factory.git" asks for credentials
    When a program fetches the source "git+<url>/acme/factory.git#main" with a cache folder and no token
    Then the forge received one request without credentials
    And the fetch fails at once with a FetchError "cannot fetch main of <url>/acme/factory.git: " and Git's "terminal prompts disabled"
