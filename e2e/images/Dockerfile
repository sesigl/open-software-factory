# The one image of the end-to-end scenarios (ADR 0076): every module and adapter of the factory from this workspace,
# packed by e2e/scripts/images.ts, so a change is tested end to end before its release. Each module service of the
# Compose profile runs its own command in it.
FROM openpolicyagent/opa:1.21.0-static AS opa

# The full Node image holds Git, which foreman and the forge adapters need, and curl for the scripted agents.
FROM node:24.11.1-bookworm
# The folders the Compose profile mounts volumes on: a new volume takes their owner.
RUN mkdir -p /factory /home/node/data /home/node/state /home/node/rendered \
  && chown -R node:node /factory /home/node
COPY --from=opa /opa /usr/local/bin/opa
WORKDIR /opt/osf
COPY package.json ./
COPY packs/ packs/
# Behind a proxy that inspects TLS, npm needs the proxy's CA: images.ts passes OSF_BUILD_CA as the secret ca.
RUN --mount=type=secret,id=ca,required=false \
  if [ -s /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi \
  && npm install --omit=dev --no-fund --no-audit \
  && npm cache clean --force
ENV PATH=/opt/osf/node_modules/.bin:$PATH
USER node
WORKDIR /home/node
