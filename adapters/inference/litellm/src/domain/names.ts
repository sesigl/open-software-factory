// What the parts of one gateway are called on the Docker host, and the images they run (ADR 0056).

/** A gateway's ID: 12 random hex digits that start made. */
export const ID = /^[0-9a-f]{12}$/;

/** The LiteLLM proxy container of the gateway, and the network it shares with its database only. */
export const gatewayName = (id: string): string => `osf-inference-${id}`;

/** The PostgreSQL container of the gateway, on its network as "db". */
export const databaseName = (id: string): string => `osf-inference-${id}-db`;

/** The label on every gateway container; `list` finds the gateways by it. */
export const GATEWAY_LABEL = "osf.inference.role=gateway";

/** The label key that holds a gateway's ID on each of its parts. */
export const ID_LABEL = "osf.inference.id";

export const LITELLM_IMAGE =
  "ghcr.io/berriai/litellm:v1.106.2@sha256:7294b90f868c5c38c99b83021c7ba46f9b439e95f8e32964c925c7d2563a03f7";

export const POSTGRES_IMAGE =
  "postgres:18-alpine@sha256:898c60cb390d1085bc97bdd6a1ae968757421df394b071848b52b1c09c89d6a5";

/** The port LiteLLM listens on inside its container. */
export const PROXY_PORT = 4000;

/** Where the gateway's config lives in the LiteLLM container. */
export const CONFIG_DIR = "/app/osf";
