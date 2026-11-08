@module=sandbox-kubernetes @owner=maintainers
Feature: What the kubernetes adapter checks before it starts a sandbox
  The kubernetes adapter starts each sandbox as an agent-sandbox SandboxClaim whose pod may reach only its own
  egress pod with iron-proxy (ADR 0055). It checks the spec and the template before it starts anything, and removes
  a sandbox that does not start.

  @id=SCN-SKUBE-001 @status=implemented
  Scenario: A spec that is no valid sandbox spec is refused with the path of the problem
    Given a sandbox spec with the CPU "four"
    When the client runs "create" with the spec
    Then create exits with code 2 and names "/cpu" as invalid

  @id=SCN-SKUBE-002 @status=implemented
  Scenario: A template that names no SandboxTemplate and no image is refused
    Given a sandbox spec with the template "small" and no SandboxTemplate "small" in the namespace
    When the client runs "create" with the spec
    Then create exits with code 1 and says that the namespace has no SandboxTemplate "small"

  @id=SCN-SKUBE-003 @status=deprecated
  Scenario: A sandbox that does not start is removed
    Given a sandbox spec with the template "hello-world:latest", an image without a shell
    When the client runs "create" with the spec
    Then create exits with code 1 and says that the sandbox did not start and was removed
    And the sandbox list does not hold that sandbox

  @id=SCN-SKUBE-004 @status=implemented @replaces=SCN-SKUBE-003
  Scenario: A sandbox that does not start is removed and create names the container and why
    Given a sandbox spec with the template "hello-world:latest", an image without a shell
    When the client runs "create" with the spec
    Then create exits with code 1 and says that the sandbox did not start and was removed
    And it says that the container "sandbox" is in a waiting state, with the reason and Kubernetes' message
    And the sandbox list does not hold that sandbox

  @id=SCN-SKUBE-005 @status=implemented
  Scenario: --help names the adapter's commands
    When the client runs "--help"
    Then the command exits with code 0 and prints "exec <ID> -- <command>..." and "egress-log <ID>"

  @id=SCN-SKUBE-006 @status=implemented
  Scenario: create without a spec is a usage error
    When the client runs "create"
    Then the command exits with code 2 and writes "sandbox-kubernetes: name the sandbox spec, like create spec.json" to standard error

  @id=SCN-SKUBE-007 @status=implemented
  Scenario: exec without a command is a usage error
    When the client runs "exec 0123456789ab --"
    Then the command exits with code 2 and writes "sandbox-kubernetes: name the command after --, like exec <ID> -- pwd" to standard error

  @id=SCN-SKUBE-008 @status=implemented
  Scenario: A sandbox ID that is not exactly 12 hex digits is a usage error
    When the client runs "destroy 0123456789abc"
    Then the command exits with code 2 and writes "sandbox-kubernetes: name a sandbox by the 12 hex digits create printed" to standard error

  @id=SCN-SKUBE-009 @status=implemented
  Scenario: A kubeconfig that kubectl cannot use makes the command fail with kubectl's error
    Given a kubeconfig whose current context "osf-missing" does not exist
    When the client runs "list" with that kubeconfig
    Then the command exits with code 1 and writes "sandbox-kubernetes: kubectl get failed: " and kubectl's error, which names "osf-missing"

  @id=SCN-SKUBE-010 @status=implemented
  Scenario: list prints the ID of a sandbox
    Given a sandbox created from a spec with the test template
    When the client runs "list"
    Then list exits with code 0 and one line of its output is the sandbox's ID

  @id=SCN-SKUBE-011 @status=implemented
  Scenario: copy prints what it copied
    Given a sandbox created from a spec with the test template
    And the file "$INPUT/notes.md" with the text "draft"
    When the client copies "notes.md" to the sandbox's "notes.md"
    Then copy exits with code 0 and prints "copied notes.md to <ID>:notes.md"

  @id=SCN-SKUBE-012 @status=implemented
  Scenario: destroy prints the ID of the sandbox it removed
    Given a sandbox created from a spec with the test template
    When the client destroys the sandbox
    Then destroy exits with code 0 and prints "destroyed <ID>"

  @id=SCN-SKUBE-013 @status=implemented
  Scenario: The sandbox has the certificate of its egress proxy's CA
    Given a sandbox created from a spec with the test template
    When the client runs "cat /etc/osf/egress-ca.crt" in the sandbox
    Then the command exits with code 0 and prints one PEM certificate

  @id=SCN-SKUBE-014 @status=implemented
  Scenario: The sandbox has no service account token and cannot gain privileges
    Given a sandbox created from a spec with the test template
    When the client runs "grep NoNewPrivs /proc/1/status" and "ls /var/run/secrets/kubernetes.io" in the sandbox
    Then the first command prints "NoNewPrivs:" with the value 1
    And the second command fails, because the folder does not exist

  @id=SCN-SKUBE-015 @status=implemented
  Scenario: A snapshot that tar cannot read fails with tar's error
    Given a sandbox created from a spec with the test template, in which "secret.txt" has the mode 000
    When the client snapshots the sandbox
    Then snapshot exits with code 1 and writes "kubectl exec failed: " and tar's error, which names "secret.txt"

  @id=SCN-SKUBE-016 @status=implemented
  Scenario: A snapshot of a sandbox that started from a snapshot holds the newer files
    Given a sandbox created from a snapshot of a sandbox in which "notes.md" says "draft"
    And in it "notes.md" says "final" and "todo.md" says "ship"
    When the client snapshots that sandbox and creates a third sandbox from the second snapshot
    Then "cat notes.md todo.md" in the third sandbox prints "finalship"

  @id=SCN-SKUBE-017 @status=implemented
  Scenario: A request around the egress proxy to the address of an allowed host does not leave the sandbox
    Given an API at "host.docker.internal" and its address on the cluster's network
    And a sandbox created from a spec with the test template and the egress allowlist "host.docker.internal"
    When the client runs "curl --noproxy '*'" for the API's address in the sandbox
    Then curl fails
    And the API received no request
