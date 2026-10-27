---
status: accepted
date: 2026-10-27
---

# 0075. The Helm chart and the published, signed module images

## Context

TODO item T-19 has a second slice: a Helm chart for platform teams, tested on kind with the same smoke subset as the
Compose profile, and published multi-arch images of the modules with signatures, SBOMs and SLSA provenance, which the
Compose profile then pulls. ADR 0074 built the module images from npm on the operator's machine and left these for
this slice. The stack (`docs/architecture/stack.md`) names the services of the Kubernetes profile: managed PostgreSQL,
object storage, NATS, Temporal, Langfuse, OpenBao and agent-sandbox. Today gatekeeper, intake, foreman and console
use PostgreSQL, NATS and Temporal; no module talks to object storage, Langfuse, OpenBao or agent-sandbox yet.

## Decision

Images:

- Each module image is `ghcr.io/sesigl/open-software-factory/<module>:<version>`: gatekeeper, intake, foreman,
  console and factory-spec, built from `deploy/images/Dockerfile` with the packages that `compose.yaml` pins. The tag is
  the module's version. A change of an adapter's pin without a new module version takes the tag `<version>-r<n>`.
- `compose.yaml` stays the one list of images and pins. Its module services name the GHCR image and keep their
  `build`, without `pull_policy`: Compose pulls the image and builds it only when the registry does not have it, for
  example a pin that moved in a pull request before its image is published.
- The workflow `publish-images` runs on every push to `main` that changes `deploy/compose/` or `deploy/images/`, and
  by hand. It reads the targets from `compose.yaml` with `docker buildx bake`, skips every tag that GHCR already has
  (tags never change), builds the rest for `linux/amd64` and `linux/arm64` with BuildKit's SBOM (SPDX) and SLSA
  provenance (`mode=max`) attestations, pushes them, and signs each image index with cosign, keyless through the
  workflow's GitHub OIDC identity. The same workflow pushes the chart as an OCI artifact,
  `oci://ghcr.io/sesigl/open-software-factory/charts/osf`, and signs it the same way.

Chart:

- `deploy/helm/osf/` is the chart `osf`. One `helm install` starts gatekeeper, intake, foreman and console with the
  same environment the Compose profile gives them, and the reference factory of `deploy/compose/factory/`.
- PostgreSQL, NATS and Temporal are in the chart for a team that has none, on by default so one command installs a
  complete factory: `postgresql.enabled`, `nats.enabled` and `temporal.enabled`. A platform team turns each off and
  names its own: `externalDatabase`, `externalNats.url` and `externalTemporal.address`. Each pod that needs a database
  creates it when it is missing, with `psql` in an init container, so a managed PostgreSQL needs no manual step.
- Secrets come from one Kubernetes Secret: the chart makes it from `secrets.*`, or uses `secrets.existingSecret`, a
  Secret that OpenBao fills through its own operator or the External Secrets Operator. A missing value fails the
  install and names it: `set secrets.foremanApiToken or secrets.existingSecret`.
- The factory definition is a ConfigMap made from `files/factory/`, a link to `deploy/compose/factory/`, or from
  `factory.files` in the values. foreman's init container commits it into Git with a fixed author and date, so equal
  files give the same factory version after every restart.
- `helm test` runs `factory plan` on the factory in a pod of the factory-spec image.
- Object storage, Langfuse, OpenBao and agent-sandbox are installed with their own charts. This chart adds their
  wiring when a module uses them.
- The testkit gets `sut.helm(chart)`: `helm` and `kubectl` on a chart of the unit in a namespace of the scenario,
  which it deletes when the scenario ends, and `url(service, port)` through `kubectl port-forward`. The scenarios run
  on kind; CI loads the images that `docker buildx bake` builds from `compose.yaml` into the cluster first.
- `make install` pins helm 4.3.1, kubectl 1.34.1 and kind 0.30.0 in `.tools/bin` like the other binaries (ADR 0011).

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Own templates for PostgreSQL, NATS and Temporal, off for production (chosen) | one chart, same images as Compose, starts in about a minute on kind | we maintain a few small templates |
| Subcharts: Temporal's, NATS's and a PostgreSQL chart | adopted charts | Temporal's chart starts four services and wants Cassandra or a schema job of its own; a remote dependency per install |
| Only external services | smallest chart | no complete factory with one command; the kind test would install three charts first |
| BuildKit attestations and cosign (chosen) | SBOM and provenance travel in the image index, which one signature covers; no extra build | provenance is SLSA build level 2, not 3 |
| slsa-github-generator's container workflow | SLSA build level 3 | a reusable workflow per image, and the SBOM still needs another tool |
| Images built from the workspace | tests the current commit | the image would not match what users install from npm (ADR 0074) |
| A separate list of images for the publish workflow | simple to read | two lists of pins that drift |

## Prior art

- [temporalio/helm-charts](https://github.com/temporalio/helm-charts) (MIT, active): Temporal's chart. Checked as a
  subchart and not chosen (above). We follow its schema setup with `temporal-sql-tool` and its server configuration,
  as the Compose profile does.
- [nats-io/k8s](https://github.com/nats-io/k8s) (Apache-2.0, active): the NATS chart. A full cluster with config
  reloader; one NATS pod with JetStream is enough here. A team with NATS sets `externalNats.url`.
- [Bitnami PostgreSQL chart](https://github.com/bitnami/charts) (Apache-2.0): its free images moved behind Bitnami
  Secure Images in 2025, so the chart is not usable without a subscription. Not chosen.
- [CloudNativePG](https://github.com/cloudnative-pg/cloudnative-pg) (Apache-2.0, active, CNCF): the operator we
  point platform teams to for a PostgreSQL they run themselves, through `externalDatabase`.
- [Langfuse's chart](https://github.com/langfuse/langfuse-k8s) (MIT, active), [OpenBao's
  chart](https://github.com/openbao/openbao-helm) (MPL-2.0, active) and
  [agent-sandbox](https://github.com/kubernetes-sigs/agent-sandbox) (Apache-2.0, active): installed beside this chart.
- [helm/chart-testing](https://github.com/helm/chart-testing) (Apache-2.0, active): lints and installs changed charts.
  Our scenarios install the chart from outside with `helm` like every other surface, so it adds nothing yet.
- [docker buildx bake](https://github.com/docker/buildx) (Apache-2.0, active): reads Compose files as build targets,
  so `compose.yaml` stays the one list. [sigstore/cosign](https://github.com/sigstore/cosign) (Apache-2.0, active):
  keyless signatures. [slsa-github-generator](https://github.com/slsa-framework/slsa-github-generator) (Apache-2.0,
  active): checked, not chosen (above).

## Consequences

- An operator verifies an image with
  `cosign verify ghcr.io/sesigl/open-software-factory/foreman:0.4.0 --certificate-oidc-issuer
  https://token.actions.githubusercontent.com --certificate-identity-regexp
  '^https://github.com/sesigl/open-software-factory/'`.
- The first push of each image makes a private GHCR package. The owner makes it public once, like the first npm
  release (`deploy/README.md#releases`). Until then Compose builds the image itself.
- Each kind scenario starts its own PostgreSQL, NATS and Temporal. Revisit when the deploy suite outgrows its budget.
- Revisit the chart's PostgreSQL, NATS and Temporal templates when a team asks for high availability: then they
  point to CloudNativePG, the NATS chart and Temporal's chart instead.
