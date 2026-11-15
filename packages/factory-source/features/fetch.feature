@module=factory-source @owner=maintainers
Feature: A factory's folder from a path or a Git remote
  factorySource gives the folder of a factory: the folder of a path, or the files of the commit of a ref of a Git
  remote, fetched into a cache, with a token for a private remote (ADR 0124, ADR 0142). pinnedFolder gives a folder of
  a Git remote at a ref, with its commit and the hash of its files, or at the commit of a pin whose hash it checks
  (ADR 0146).

  @id=SCN-FSOURCE-001 @status=implemented
  Scenario: A factory in a Git remote gives the files of the commit of its ref
    Given a "factory.yaml" is committed on the branch "main" of a Git repository at a "file://" URL
    When a program fetches the source "git+<url>#main" with a cache folder
    Then it gets the commit of "main", the folder "<cache>/<commit>" and its "factory.yaml" with its text
    And the cache folder holds the bare repository "repository.git" and the folder of the commit, nothing else

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

  @id=SCN-FSOURCE-010 @status=implemented
  Scenario: A remote without a ref and without a commit is a FetchError that names HEAD
    Given a Git repository at a "file://" URL without a commit
    When a program fetches the source "git+<url>" with a cache folder
    Then the fetch fails with a FetchError "cannot fetch HEAD of file://<path>: " and Git's message "couldn't find remote ref HEAD"

  @id=SCN-FSOURCE-004 @status=implemented
  Scenario: A path, also one with "git+" inside it, gives its file and its folder, with no commit and nothing in the cache
    Given the file "git+factory/hello.yaml" that is not committed
    When a program fetches the source "<path of git+factory/hello.yaml>" with a cache folder
    Then it gets the folder "git+factory", the file "git+factory/hello.yaml" and no commit
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

  @id=SCN-FSOURCE-011 @status=implemented
  Scenario: A URL that carries a user and a password is named without them in a FetchError
    Given a forge over HTTP whose repository "/acme/factory.git" asks for credentials
    When a program fetches the source "git+http://ada:url-password-0002@<host>/acme/factory.git#main" with a cache folder
    Then the fetch fails with a FetchError "cannot fetch main of http://<host>/acme/factory.git: "
    And the message does not contain "ada" or "url-password-0002"

  @id=SCN-FSOURCE-012 @status=implemented
  Scenario: A folder of a Git remote at a ref gives its commit, its folder in the cache and the hash of its files
    Given the folder "skills/review" with "SKILL.md" and "notes/checklist.md" is committed on the branch "main" of a Git repository at a "file://" URL
    When a program fetches the folder "git+<url>#main:skills/review" with a cache folder and no pin
    Then it gets the commit of "main" and the folder "skills/review" of that commit below the cache folder, with both files
    And the hash "h1:" with the base64 of the SHA-256 of one line "<SHA-256 of the file>  <path>" per file, sorted by path

  @id=SCN-FSOURCE-013 @status=implemented
  Scenario: A folder with a pin gives the pinned commit after its ref moved, and from the cache once the remote is gone
    Given the folder "skills/review" is committed on the branch "main" of a Git repository at a "file://" URL, and a program pinned "git+<url>#main:skills/review"
    And "main" has a newer commit that changes "skills/review/SKILL.md"
    When the program fetches the folder with its pin, and again with its pin after the repository was removed
    Then both fetches give the pinned commit and the first text of "SKILL.md"

  @id=SCN-FSOURCE-014 @status=implemented
  Scenario: A pin whose hash is not the hash of the fetched files is a FetchError that names both hashes
    Given the folder "skills/review" is committed on the branch "main" of a Git repository at a "file://" URL
    When a program fetches "git+<url>#main:skills/review" with a pin of the commit of "main" and the hash "h1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
    Then the fetch fails with a FetchError "the folder skills/review of <url> at <commit> has the hash <hash>, not the hash h1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= of its pin"

  @id=SCN-FSOURCE-015 @status=implemented
  Scenario: A reference without "git+" or a folder, a folder outside the repository and a folder that the commit lacks are each a FetchError
    Given the folder "skills/review" is committed on the branch "main" of a Git repository at a "file://" URL
    When a program fetches "<url>#main:skills/review", "git+<url>#main", "git+<url>#main:../review", "git+<url>#main:/etc" and "git+<url>#main:skills/missing"
    Then the fetches fail with the FetchErrors "is no git+<url>#<ref>:<path>" twice, "names a folder outside its repository" twice and "the commit <commit> of <url> has no folder skills/missing"

  @id=SCN-FSOURCE-016 @status=implemented
  Scenario: A folder that is a symbolic link, lies behind one or holds one is a FetchError that names the link
    Given the folder "skills/review" is committed on the branch "main" of a Git repository at a "file://" URL
    And the commit also holds the links "skills/out" to "/etc", "linked" to "skills" and "skills/review/notes.md" to "/etc/hostname"
    When a program fetches "git+<url>#main:skills/out", "git+<url>#main:linked/review" and "git+<url>#main:skills/review"
    Then the fetches fail with the FetchErrors "the commit <commit> of <url> has the symbolic link" "skills/out at skills/out", "linked at linked/review" and "skills/review/notes.md at skills/review"
