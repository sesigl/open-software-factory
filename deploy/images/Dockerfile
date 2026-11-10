# The image of one module of the factory and its adapters, installed from npm at the versions the Compose profile
# pins (ADR 0074). Build it with the build argument PACKAGES, the packages separated by spaces, like
# "@opensoftware/foreman@0.4.0 @opensoftware/forge-github@0.5.0". The target gatekeeper adds OPA. The target agent adds
# GitHub's gh and make, for the agents that clone, build and push: with a harness adapter it is the template of the
# agents' sandboxes (ADR 0096). The target foreman adds the Docker CLI to it, for the docker sandbox adapter, and
# kubectl, for the kubernetes sandbox adapter of the Helm chart. The target litellm is the LLM gateway of the profile
# and the chart, with its Python bytecode compiled (ADR 0098).
ARG NODE_IMAGE=node:24.11.1-bookworm-slim

FROM openpolicyagent/opa:1.21.0-static AS opa

FROM docker:29.1.3-cli AS docker

FROM registry.k8s.io/kubectl:v1.34.1 AS kubectl

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

FROM agent AS foreman
COPY --from=docker /usr/local/bin/docker /usr/local/bin/docker
COPY --from=kubectl /bin/kubectl /usr/local/bin/kubectl

# The upstream image has no bytecode, so each new container compiled LiteLLM's modules again when it started: about a
# third of its start. Compiled once here, the gateway is ready sooner, also in every scenario that starts it.
FROM ghcr.io/berriai/litellm:v1.106.2 AS litellm
LABEL org.opencontainers.image.source="https://github.com/sesigl/open-software-factory" \
  org.opencontainers.image.licenses="MIT"
RUN python -m compileall -q -j 0 /app/.venv/lib/python3.13/site-packages
