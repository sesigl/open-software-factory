@module=deploy @owner=maintainers
Feature: The Helm chart installs a complete factory on Kubernetes with one command
  A platform team runs "helm install" with the chart in "deploy/helm/osf/" and a values file that sets the secrets.
  The chart starts gatekeeper, intake, foreman and console with the reference factory, and PostgreSQL, NATS and
  Temporal unless the values name the team's own (ADR 0075). The scenarios run on kind, each release in a namespace
  of its own.

  @id=SCN-DIST-007 @status=planned @realizes=SCN-FACTORY-OPEN-006
  Scenario: Every workload of the Helm chart is ready after one command
    Given a kind cluster with the images of the Compose profile
    And a values file that sets every value under "secrets"
    When the operator runs "helm install osf deploy/helm/osf --values values.yaml --wait"
    Then the command exits with code 0
    And the workloads "postgres", "nats", "temporal", "gatekeeper", "intake", "foreman" and "console" are ready

  @id=SCN-DIST-008 @status=planned
  Scenario: The Helm chart names the secret that the values are missing
    Given a kind cluster with the images of the Compose profile
    And a values file that sets every value under "secrets" except "foremanApiToken"
    When the operator runs "helm install osf deploy/helm/osf --values values.yaml --wait"
    Then the command exits with code 1
    And the output contains "set secrets.foremanApiToken or secrets.existingSecret"

  @id=SCN-DIST-009 @status=planned
  Scenario: The console of the Helm chart lists the runs of its foreman
    Given a kind cluster with the images of the Compose profile
    And a values file that sets every value under "secrets"
    When the operator runs "helm install osf deploy/helm/osf --values values.yaml --wait"
    Then the console's page "/" answers 200 with the heading "Runs"
    And the page does not say "did not answer"

  @id=SCN-DIST-010 @status=planned
  Scenario: The console of the Helm chart shows the agents of the reference factory
    Given a kind cluster with the images of the Compose profile
    And a values file that sets every value under "secrets"
    When the operator runs "helm install osf deploy/helm/osf --values values.yaml --wait"
    Then the console's page "/factory" lists the agents "triage", "spec", "implement", "review" and "ship"

  @id=SCN-DIST-011 @status=planned
  Scenario: The test of the Helm chart plans the reference factory without problems
    Given a kind cluster with the images of the Compose profile
    And the operator installed the chart with a values file that sets every value under "secrets"
    When the operator runs "helm test osf --logs"
    Then the command exits with code 0
    And the output contains "Plan: 7 to add, 0 to change, 0 to remove, 0 drifted."
