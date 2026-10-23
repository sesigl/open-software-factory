// What the parts of one sandbox are called on the Docker host, and how a sandbox ID looks.
import { EGRESS_PORT } from "@opensoftware/sandbox-egress";

/** The sandbox's ID: the first 12 hex digits of its container's ID, which Docker chose. */
export const ID = /^[0-9a-f]{12}$/;

/** The container of the sandbox, and the internal network it shares with its egress proxy only. */
export const sandboxName = (id: string): string => `osf-sandbox-${id}`;

/** The iron-proxy container of the sandbox. */
export const egressName = (id: string): string => `osf-sandbox-${id}-egress`;

/** The label on every sandbox container; `list` finds the sandboxes by it. */
export const ROLE_LABEL = "osf.sandbox.role=sandbox";

/** The URL the sandbox reaches its egress proxy at, on the network alias "egress". */
export const EGRESS_URL = `http://egress:${EGRESS_PORT}`;
