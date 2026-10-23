// What the objects of one sandbox are called in the namespace, and how a sandbox ID looks (ADR 0055).
import { EGRESS_PORT } from "@opensoftware/sandbox-egress";

/** The sandbox's ID: 12 random hex digits. */
export const ID = /^[0-9a-f]{12}$/;

/** The SandboxTemplate, SandboxWarmPool and SandboxClaim of the sandbox; agent-sandbox names its Sandbox the same. */
export const sandboxName = (id: string): string => `osf-sandbox-${id}`;

/** The egress pod, its Service, its ConfigMap and its Secrets. */
export const egressName = (id: string): string => `osf-sandbox-${id}-egress`;

/** The ConfigMap with the CA of the egress proxy, which the sandbox mounts. */
export const caName = (id: string): string => `osf-sandbox-${id}-ca`;

/** The PersistentVolumeClaim and the SandboxTemplate of a snapshot. */
export const snapshotName = (id: string): string => `osf-snapshot-${id}`;

/** The URL the sandbox reaches its egress proxy at: the Service of the egress pod. */
export const egressUrl = (id: string): string => `http://${egressName(id)}:${EGRESS_PORT}`;

/** The label every object of a sandbox carries; destroy removes the sandbox by it. */
export const ID_LABEL = "osf.sandbox.id";

/** The label that tells the sandbox's objects from its egress objects; list finds the sandboxes by it. */
export const ROLE_LABEL = "osf.sandbox.role";

/** The annotation of a SandboxTemplate that keeps the pod the sandbox started from, for snapshot. */
export const BASE_ANNOTATION = "osf.sandbox/base";

/** The names of the volumes the adapter adds to the sandbox's pod. */
export const VOLUMES = { workspace: "osf-workspace", ca: "osf-egress-ca", snapshot: "osf-snapshot" } as const;

/** A template that is an image: a name with "/", ":" or "@", which no Kubernetes name has. */
export const isImage = (template: string): boolean => /[/:@]/.test(template);
