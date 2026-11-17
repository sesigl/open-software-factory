# The image of one module of the factory and its adapters, installed from npm at the versions the Compose profile
# pins (ADR 0074). Build it with the build argument PACKAGES, the packages separated by spaces, like
# "@opensoftware/foreman@0.4.0 @opensoftware/forge-github@0.5.0". The target gatekeeper adds OPA. The target agent adds
# GitHub's gh and make, for the agents that clone, build and push: with a harness adapter it is the template of the
# agents' sandboxes (ADR 0096). The target foreman adds the Docker CLI to it, for the docker sandbox adapter, and
# kubectl, for the kubernetes sandbox adapter of the Helm chart. The target dogfood adds pnpm and lychee to it: the
# template of the sandboxes of this repository's factory, which run its `make check-fast` (ADR 0164). The target litellm is the LLM gateway of the profile
# and the chart, with its Python bytecode compiled (ADR 0098).
ARG NODE_IMAGE=node:24.11.1-bookworm-slim

FROM openpolicyagent/opa:1.21.0-static AS opa

FROM docker:29.1.3-cli AS docker

FROM registry.k8s.io/kubectl:v1.34.1 AS kubectl

# lychee, which DOCS-LINKS of `make check-fast` runs, at the version and SHA-256 sums of its Linux builds that
# tools/scaffold/install-tools.ts pins: the service dogfood-template of compose.yaml passes them, as osf profile-pins
# writes them (ADR 0172).
FROM ${NODE_IMAGE} AS lychee
ARG TARGETARCH
ARG LYCHEE_VERSION
ARG LYCHEE_SHA256_AMD64
ARG LYCHEE_SHA256_ARM64
RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*
RUN --mount=type=secret,id=ca,required=false \
  test -n "$LYCHEE_VERSION" \
  && if [ -s /run/secrets/ca ]; then export CURL_CA_BUNDLE=/run/secrets/ca; fi \
  && case "$TARGETARCH" in \
    amd64) build=x86_64 sha256=$LYCHEE_SHA256_AMD64 ;; \
    arm64) build=aarch64 sha256=$LYCHEE_SHA256_ARM64 ;; \
    *) echo "no lychee for $TARGETARCH" && exit 1 ;; \
  esac \
  && test -n "$sha256" \
  && curl -fsSL --retry 3 -o /tmp/lychee.tar.gz \
    "https://github.com/lycheeverse/lychee/releases/download/lychee-v$LYCHEE_VERSION/lychee-$build-unknown-linux-gnu.tar.gz" \
  && echo "$sha256  /tmp/lychee.tar.gz" | sha256sum --check --strict \
  && tar -xzf /tmp/lychee.tar.gz -C /usr/local/bin lychee

FROM ${NODE_IMAGE} AS module
# GHCR links the published image to its repository through this label (ADR 0075).
LABEL org.opencontainers.image.source="https://github.com/sesigl/open-software-factory" \
  org.opencontainers.image.licenses="Apache-2.0"
# foreman reads a run's factory version from Git; the forge adapters push with it.
RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates git \
  && rm -rf /var/lib/apt/lists/*
# The folders the Compose profile mounts volumes on: a new volume takes their owner.
RUN mkdir -p /factory /home/node/data /home/node/state /home/node/rendered \
  && chown -R node:node /factory /home/node
ARG PACKAGES
# Behind a proxy that inspects TLS, npm needs the proxy's CA: the Compose profile passes OSF_BUILD_CA as the secret ca.
RUN --mount=type=secret,id=ca,required=false \
  test -n "$PACKAGES" \
  && if [ -s /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi \
  && npm install --global --omit=dev --no-fund --no-audit $PACKAGES \
  && npm cache clean --force
USER node
WORKDIR /home/node

FROM module AS gatekeeper
COPY --from=opa /opa /usr/local/bin/opa

FROM module AS agent
USER root
# In a sandbox, git takes the token from gh, whose GH_TOKEN is the secret's placeholder, and commits as the factory.
RUN apt-get update \
  && apt-get install --yes --no-install-recommends gh make \
  && rm -rf /var/lib/apt/lists/* \
  && git config --system credential.https://github.com.helper '!gh auth git-credential' \
  && git config --system user.name factory \
  && git config --system user.email factory@localhost
# Claude Code reaches only the hosts of the sandbox's egress: no telemetry, error reports or update checks.
ENV CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
USER node

# The template of the sandboxes of this repository's factory (ADR 0164): its agents run `make check-fast`, which needs
# pnpm at the version of packageManager in package.json, which compose.yaml passes as PNPM_VERSION, and lychee. They
# install the packages with pnpm through the sandbox's egress from registry.npmjs.org. The system tests and
# `make verify` stay with CI: the sandbox has no Docker.
FROM agent AS dogfood
USER root
ARG PNPM_VERSION
COPY --from=lychee /usr/local/bin/lychee /usr/local/bin/lychee
RUN --mount=type=secret,id=ca,required=false \
  test -n "$PNPM_VERSION" \
  && if [ -s /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi \
  && npm install --global --no-fund --no-audit "pnpm@$PNPM_VERSION" \
  && npm cache clean --force
# turbo's default of ten tasks at a time ran out of memory in the typechecks with 4 GiB; four at a time fit 4 GiB.
ENV TURBO_CONCURRENCY=4
USER node

FROM agent AS foreman
COPY --from=docker /usr/local/bin/docker /usr/local/bin/docker
COPY --from=kubectl /bin/kubectl /usr/local/bin/kubectl

# The upstream image has no bytecode, so each new container compiled LiteLLM's modules again when it started: about a
# third of its start. Compiled once here, the gateway is ready sooner, also in every scenario that starts it.
# BerriAI's enterprise code has a license of its own, which allows changed copies only with a subscription, so the image
# holds none of it (ADR 0102); the profile and the chart use no enterprise feature.
FROM ghcr.io/berriai/litellm:v1.106.2 AS litellm
LABEL org.opencontainers.image.source="https://github.com/sesigl/open-software-factory" \
  org.opencontainers.image.licenses="MIT"
RUN rm -rf /app/enterprise /app/.venv/lib/python3.13/site-packages/litellm_enterprise \
    /app/.venv/lib/python3.13/site-packages/litellm_enterprise-*.dist-info \
  && python -m compileall -q -j 0 /app/.venv/lib/python3.13/site-packages
