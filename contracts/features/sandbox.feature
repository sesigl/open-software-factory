@module=contracts @owner=maintainers
Feature: The sandbox port's files and copies
  A sandbox adapter reads its sandbox spec with readDocument and the ends of the port's copy with copyEnds, so every
  adapter reads them the same way. Each gives the problem and leaves the usage error to the adapter (ADR 0147).

  @id=SCN-CTR-017 @status=implemented @replaces=SCN-SEGRESS-011
  Scenario: readDocument gives a file's document and each problem with its path
    Given the file "spec.json" with a sandbox spec whose CPU is "four"
    When the adapter calls readDocument with "sandbox-spec" and the file
    Then the document is the spec in the file
    And the one problem is "/cpu" "must be number"

  @id=SCN-CTR-018 @status=implemented @replaces=SCN-SEGRESS-019
  Scenario: A copy into a sandbox names a path below its working folder
    When the adapter calls copyEnds with "notes.md" and "0123456789ab:docs/notes.md"
    Then it gives the sandbox "0123456789ab", the path "/workspace/docs/notes.md", the client's path "notes.md" and a copy into the sandbox

  @id=SCN-CTR-019 @status=implemented @replaces=SCN-SEGRESS-020
  Scenario: A copy out of a sandbox keeps an absolute path
    When the adapter calls copyEnds with "0123456789ab:/tmp/result.txt" and "result.txt"
    Then it gives the sandbox "0123456789ab", the path "/tmp/result.txt", the client's path "result.txt" and a copy out of the sandbox

  @id=SCN-CTR-020 @status=implemented @replaces=SCN-SEGRESS-021
  Scenario: A copy that names a sandbox on both sides gives its problem
    When the adapter calls copyEnds with "0123456789ab:a.txt" and "ba9876543210:b.txt"
    Then it gives the problem "name the sandbox on one side only, as <ID>:<path>"
