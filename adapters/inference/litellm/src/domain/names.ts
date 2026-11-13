// What the parts of one gateway are called on the Docker host, the images they run (ADR 0056), and a run's key and its
// alias (ADR 0108).
import { createHmac } from "node:crypto";

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

/** The label keys that hold the gateway's owner, OSF_INFERENCE_OWNER, a process ID, and its host (ADR 0090). */
export const OWNER_LABEL = "osf.inference.owner";
export const HOST_LABEL = "osf.inference.host";

export const LITELLM_IMAGE =
  "ghcr.io/berriai/litellm:v1.106.2@sha256:7294b90f868c5c38c99b83021c7ba46f9b439e95f8e32964c925c7d2563a03f7";

export const POSTGRES_IMAGE =
  "postgres:18-alpine@sha256:898c60cb390d1085bc97bdd6a1ae968757421df394b071848b52b1c09c89d6a5";

/** The port LiteLLM listens on inside its container. */
export const PROXY_PORT = 4000;

/** Where the gateway's config lives in the LiteLLM container. */
export const CONFIG_DIR = "/app/osf";

/**
 * The Docker volume that keeps the compiled Python files of LiteLLM for all gateways, and its path in the container.
 * The image ships almost none, so without it each start compiles LiteLLM again: about half of a start's CPU time.
 * Python compiles a file again when its source's time or size differs, so files of another image do no harm.
 */
export const PYTHON_CACHE = "osf-inference-python:/var/cache/osf-python";
export const PYTHON_CACHE_ENV = "PYTHONPYCACHEPREFIX=/var/cache/osf-python";

/** The alias of a run's key; LiteLLM keeps aliases unique, so a second key for the run is refused (ADR 0108). */
export const runKeyAlias = (id: string, run: string): string => `osf-run-${id}-${run}`;

/** A run's key: the same for the same run of a gateway, and only a holder of the gateway's master key can make it. */
export const runKeyValue = (masterKey: string, id: string, run: string): string =>
  `sk-osf-run-${createHmac("sha256", masterKey).update(`${id}\n${run}`).digest("hex").slice(0, 48)}`;
