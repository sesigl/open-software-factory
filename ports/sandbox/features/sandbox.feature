@port=sandbox @owner=maintainers
Feature: Running commands in an isolated sandbox
  A sandbox adapter is a program with the commands create, exec, copy, snapshot, destroy, list and egress-log. A
  sandbox starts from a sandbox spec: a template, resources, the hosts it may reach, its secrets as references and
  the MCP servers it may call. Every request that leaves the sandbox passes its egress proxy, which refuses other
  hosts and puts in the real secrets (ADR 0054). The test template is an image with a shell and curl.

  @id=SCN-SANDBOX-001 @status=implemented @conformance @realizes=SCN-FACTORY-RUNTIME-004
  Scenario: A command runs in the sandbox's working folder
    Given a sandbox spec with the test template
    When the client creates a sandbox from the spec and runs "pwd" in it
    Then the command prints "/workspace" and exits with code 0

  @id=SCN-SANDBOX-002 @status=implemented @conformance
  Scenario: exec exits with the exit code of the command
    Given a sandbox created from a spec with the test template
    When the client runs "exit 3" in the sandbox
    Then exec exits with code 3

  @id=SCN-SANDBOX-003 @status=implemented @conformance @realizes=SCN-FACTORY-RUNTIME-004
  Scenario: The sandbox gets the declared CPU and memory
    Given a sandbox spec with the test template, the CPU 0.5 and the memory "256Mi"
    When the client creates a sandbox from the spec and reads its CPU quota and memory limit
    Then the CPU quota is 50000 of every 100000 microseconds
    And the memory limit is 268435456 bytes

  @id=SCN-SANDBOX-004 @status=implemented @conformance
  Scenario: A declared variable is in the sandbox's environment
    Given a sandbox spec with the test template and the variable "CI" set to "true"
    When the client creates a sandbox from the spec and runs "printenv CI" in it
    Then the command prints "true"

  @id=SCN-SANDBOX-005 @status=implemented @conformance @realizes=SCN-FACTORY-RUNTIME-003
  Scenario: A request to a host outside the egress allowlist is refused and logged
    Given a sandbox created from a spec with the test template and the egress allowlist "host.docker.internal"
    When the client runs "curl http://api.example.invalid/" in the sandbox
    Then the request gets the status 403
    And the egress log holds a request to "api.example.invalid" refused by "allowlist"

  @id=SCN-SANDBOX-006 @status=implemented @conformance @realizes=SCN-FACTORY-RUNTIME-003
  Scenario: A request around the egress proxy does not leave the sandbox
    Given an API at "host.docker.internal"
    And a sandbox created from a spec with the test template and the egress allowlist "host.docker.internal"
    When the client runs "curl --noproxy '*'" for the API in the sandbox
    Then curl fails
    And the API received no request

  @id=SCN-SANDBOX-007 @status=implemented @conformance @realizes=SCN-FACTORY-RUNTIME-006
  Scenario: The sandbox's environment holds a placeholder, never the real secret
    Given the secret file "linear-token" with the value "lin_real_7f3a"
    And a sandbox created from a spec with the test template and the secret "LINEAR_TOKEN" from "ref:file/linear-token"
    When the client runs "env" in the sandbox
    Then the output has the variable "LINEAR_TOKEN"
    And the output does not contain "lin_real_7f3a"

  @id=SCN-SANDBOX-008 @status=implemented @conformance @realizes=SCN-FACTORY-RUNTIME-006
  Scenario: A request through the egress proxy reaches the API with the real secret
    Given the secret file "linear-token" with the value "lin_real_7f3a"
    And an API at "host.docker.internal" that answers "GET /viewer"
    And a sandbox created from a spec with the test template, the egress allowlist "host.docker.internal" and the secret "LINEAR_TOKEN" from "ref:file/linear-token"
    When the client runs "curl -H 'Authorization: Bearer $LINEAR_TOKEN'" for "/viewer" of the API in the sandbox
    Then the API received "GET /viewer" with the header "Authorization: Bearer lin_real_7f3a"
    And the egress log holds an allowed request to "/viewer" in which the proxy put the secret "LINEAR_TOKEN"

  @id=SCN-SANDBOX-009 @status=implemented @conformance @realizes=SCN-FACTORY-RUNTIME-007
  Scenario: A call to an MCP server that the spec does not declare is refused and logged
    Given a sandbox created from a spec with the test template and the MCP server "wiki" with the tool "search"
    When the client calls the tool "create_issue" of "http://tracker.example.invalid/mcp" from the sandbox
    Then the request gets the status 403
    And the egress log holds a request to "tracker.example.invalid" refused by "allowlist"

  @id=SCN-SANDBOX-010 @status=implemented @conformance @realizes=SCN-FACTORY-DATA-004
  Scenario: A call to a declared tool of a declared MCP server reaches the server
    Given an MCP server "wiki" at "host.docker.internal" that answers every call
    And a sandbox created from a spec with the test template and the MCP server "wiki" with the tool "search"
    When the client calls the tool "search" of the MCP server "wiki" from the sandbox
    Then the MCP server received a call of the tool "search"

  @id=SCN-SANDBOX-011 @status=implemented @conformance @realizes=SCN-FACTORY-RUNTIME-007
  Scenario: A call to a tool that the spec does not declare is refused and logged
    Given an MCP server "wiki" at "host.docker.internal" that answers every call
    And a sandbox created from a spec with the test template and the MCP server "wiki" with the tool "search"
    When the client calls the tool "delete_page" of the MCP server "wiki" from the sandbox
    Then the call gets a JSON-RPC error
    And the MCP server received no request
    And the egress log holds a call of the tool "delete_page" of "wiki" refused by "mcp"

  @id=SCN-SANDBOX-012 @status=implemented @conformance
  Scenario: A file copied into the sandbox can be read there
    Given a sandbox created from a spec with the test template
    And the file "$INPUT/notes.md" with the text "draft"
    When the client copies "notes.md" to the sandbox's "notes.md" and runs "cat notes.md" in it
    Then the command prints "draft"

  @id=SCN-SANDBOX-013 @status=implemented @conformance
  Scenario: A file written in the sandbox can be copied out
    Given a sandbox created from a spec with the test template
    When the client runs "echo done > result.txt" in the sandbox and copies the sandbox's "result.txt" to "$OUTPUT/result.txt"
    Then "$OUTPUT/result.txt" says "done"

  @id=SCN-SANDBOX-014 @status=implemented @conformance
  Scenario: A sandbox created from a snapshot holds the files of the snapshot
    Given a sandbox created from a spec with the test template, in which "notes.md" says "draft"
    When the client snapshots the sandbox and creates a second sandbox from the snapshot
    Then "cat notes.md" in the second sandbox prints "draft"

  @id=SCN-SANDBOX-015 @status=implemented @conformance @realizes=SCN-FACTORY-RUNTIME-004
  Scenario: destroy removes the sandbox and its data
    Given a sandbox created from a spec with the test template
    When the client destroys the sandbox
    Then the sandbox list does not hold the sandbox
    And exec in the sandbox fails with "no sandbox"
