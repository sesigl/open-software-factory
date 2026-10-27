# The image of one module of the factory and its adapters, installed from npm at the versions the Compose profile
# pins (ADR 0074). Build it with the build argument PACKAGES, the packages separated by spaces, like
# "@opensoftware/foreman@0.4.0 @opensoftware/forge-github@0.5.0". The target gatekeeper adds OPA.
ARG NODE_IMAGE=node:24.11.1-bookworm-slim

FROM openpolicyagent/opa:1.21.0-static AS opa

FROM ${NODE_IMAGE} AS module
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
