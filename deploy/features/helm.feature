@module=deploy @owner=maintainers
Feature: The Helm chart installs a complete factory on Kubernetes with one command
  A platform team runs "helm install" with the chart in "deploy/helm/osf/" and a values file that sets the secrets.
  The chart starts LiteLLM, gatekeeper, intake, foreman and console with the reference factory, and PostgreSQL, NATS
  and Temporal unless the values name the team's own (ADR 0075). The scenarios run on kind, each release in a namespace
  of its own.

  @id=SCN-DIST-007 @status=deprecated @realizes=SCN-FACTORY-OPEN-006
  Scenario: Every workload of the Helm chart is ready after one command
    Given a kind cluster with the images of the Compose profile
    And a values file that sets every value under "secrets"
    When the operator runs "helm install osf deploy/helm/osf --values values.yaml --wait --timeout 10m"
    Then the command exits with code 0
    And the workloads "postgres", "nats", "temporal", "gatekeeper", "intake", "foreman" and "console" are ready

  @id=SCN-DIST-019 @status=implemented @realizes=SCN-FACTORY-OPEN-006 @replaces=SCN-DIST-007
  Scenario: Every workload of the Helm chart is ready after one command, the LLM gateway included
    Given a kind cluster with the images of the Compose profile
    And a values file that sets every value under "secrets"
    When the operator runs "helm install osf deploy/helm/osf --values values.yaml --wait --timeout 10m"
    Then the command exits with code 0
    And the workloads "postgres", "nats", "temporal", "litellm", "gatekeeper", "intake", "foreman" and "console" are ready

  @id=SCN-DIST-008 @status=implemented
  Scenario: The Helm chart names the secret that the values are missing
    Given a kind cluster with the images of the Compose profile
    And a values file that sets every value under "secrets" except "foremanApiToken"
    When the operator runs "helm install osf deploy/helm/osf --values values.yaml --wait --timeout 10m"
    Then the command exits with code 1
    And the output contains "set secrets.foremanApiToken or secrets.existingSecret"

  @id=SCN-DIST-009 @status=implemented
  Scenario: The console of the Helm chart lists the runs of its foreman
    Given a kind cluster with the images of the Compose profile
    And a values file that sets every value under "secrets"
    When the operator runs "helm install osf deploy/helm/osf --values values.yaml --wait --timeout 10m"
    Then the console's page "/" answers 200 with the heading "Runs"
    And the page does not say "did not answer"

  @id=SCN-DIST-010 @status=implemented
  Scenario: The console of the Helm chart shows the agents of the reference factory
    Given a kind cluster with the images of the Compose profile
    And a values file that sets every value under "secrets"
    When the operator runs "helm install osf deploy/helm/osf --values values.yaml --wait --timeout 10m"
    Then the console's page "/factory" lists the agents "triage", "spec", "implement", "review" and "ship"

  @id=SCN-DIST-011 @status=deprecated
  Scenario: The test of the Helm chart plans the reference factory without problems
    Given a kind cluster with the images of the Compose profile
    And the operator installed the chart with a values file that sets every value under "secrets"
    When the operator runs "helm test osf --logs"
    Then the command exits with code 0
    And the output contains "Plan: 7 to add, 0 to change, 0 to remove, 0 drifted."

  @id=SCN-DIST-021 @status=implemented @replaces=SCN-DIST-011
  Scenario: The test of the Helm chart plans the reference factory without problems, with its inference config
    Given a kind cluster with the images of the Compose profile
    And the operator installed the chart with a values file that sets every value under "secrets"
    When the operator runs "helm test osf --logs"
    Then the command exits with code 0
    And the output contains "Plan: 8 to add, 0 to change, 0 to remove, 0 drifted."

  @id=SCN-DIST-022 @status=implemented @realizes=SCN-FACTORY-RUNTIME-004
  Scenario: The foreman of the Helm chart starts a sandbox of agent-sandbox from the agents' template, with rights only in the sandboxes' namespace
    Given a kind cluster with agent-sandbox and the images of the Compose profile
    And the operator installed the chart with a values file that sets every value under "secrets"
    When the deployment "foreman" runs "sandbox-kubernetes create" with a spec of the agents' template of the reference factory and the egress allowlist "litellm"
    Then the sandbox has the programs "harness-claude-code", "gh", "git" and "make"
    And in the sandbox, "GET http://litellm:4000/health/liveliness" answers 200, and a request to the chart's PostgreSQL fails
    And after "sandbox-kubernetes destroy", "sandbox-kubernetes list" in the deployment "foreman" does not list the sandbox
    And the service account of "foreman" may create sandbox claims in the namespace "<release namespace>-sandboxes", and may read no secret of the release namespace

  @id=SCN-DIST-033 @status=implemented
  Scenario: The chart takes a forge token without Slack, and asks on pull requests only
    Given a kind cluster with the images of the Compose profile
    And a values file that sets every value under "secrets" but the two Slack secrets, and sets "forgeToken"
    When the operator runs "helm template osf deploy/helm/osf --values values.yaml"
    Then the command exits with code 0
    And the deployment "gatekeeper" runs "gatekeeper serve" without "--channel", with "GATEKEEPER_FORGE_TOKEN" from the key "forge-token" and without a Slack variable
    And the release's Secret has no key "gatekeeper-slack-token" or "gatekeeper-slack-signing-secret"

  @id=SCN-DIST-035 @status=implemented
  Scenario: The chart runs the improvement jobs as a CronJob on foreman's run records, without scorers by default
    Given a kind cluster with the images of the Compose profile
    And a values file that sets every value under "secrets" and "improve.enabled" to true
    When the operator runs "helm template osf deploy/helm/osf --values values.yaml"
    Then the command exits with code 0
    And the CronJob "osf-improve" runs "ledger report" and "observer analyze" in the image "observer", with the claim "osf-foreman" read-only and "IMPROVE_SCORERS" empty
    And the deployment "console" reads "CONSOLE_IMPROVE_DIR" from the claim "osf-improve", read-only
