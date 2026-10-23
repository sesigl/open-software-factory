// The Kubernetes objects of one sandbox (ADR 0055): the egress pod with iron-proxy, its Service and configuration,
// and the agent-sandbox SandboxTemplate, SandboxWarmPool and SandboxClaim of the sandbox itself. No I/O.
import type { SandboxSpec } from "@opensoftware/contracts";
import {
  CA_FILE,
  EGRESS_IMAGE,
  EGRESS_PORT,
  PROXY_DIR,
  START_SCRIPT,
  sandboxEnv,
  WORKSPACE,
} from "@opensoftware/sandbox-egress";
import { BASE_ANNOTATION, caName, egressName, egressUrl, ID_LABEL, ROLE_LABEL, sandboxName, VOLUMES } from "./names.ts";
import type { Container, PodTemplate } from "./pod.ts";
import type { Settings } from "./settings.ts";

const EXTENSIONS = "extensions.agents.x-k8s.io/v1beta1";

/** Where the egress pod mounts its ConfigMap; the start script copies the configuration into PROXY_DIR. */
const CONFIG_DIR = "/osf-config";

const labels = (id: string, role: "sandbox" | "egress") => ({ [ID_LABEL]: id, [ROLE_LABEL]: role });

/** The pod of a template that is an image: one container "sandbox". */
export const imagePod = (image: string): PodTemplate => ({ spec: { containers: [{ name: "sandbox", image }] } });

/** The egress pod's ConfigMap: iron-proxy's configuration and its start script. */
export function egressConfig(id: string, config: unknown): unknown {
  return {
    apiVersion: "v1",
    kind: "ConfigMap",
    metadata: { name: egressName(id), labels: labels(id, "egress") },
    data: { "proxy.yaml": `${JSON.stringify(config, null, 2)}\n`, "start.sh": START_SCRIPT },
  };
}

/** The egress proxy's own variables as a Secret that only the egress pod reads. */
export function egressEnv(id: string, variables: Record<string, string>): unknown {
  return {
    apiVersion: "v1",
    kind: "Secret",
    metadata: { name: egressName(id), labels: labels(id, "egress") },
    type: "Opaque",
    stringData: variables,
  };
}

/** The egress pod: iron-proxy with its configuration, its variables and, when there are any, the secret files. */
export function egressPod(id: string, settings: Settings, files: string | undefined): unknown {
  const name = egressName(id);
  const mounts = [
    { name: "state", mountPath: PROXY_DIR },
    { name: "config", mountPath: CONFIG_DIR, readOnly: true },
    ...(files ? [{ name: "secrets", mountPath: `${PROXY_DIR}/secrets`, readOnly: true }] : []),
  ];
  return {
    apiVersion: "v1",
    kind: "Pod",
    metadata: { name, labels: labels(id, "egress") },
    spec: {
      ...(settings.hostAliases.length ? { hostAliases: settings.hostAliases } : {}),
      automountServiceAccountToken: false,
      containers: [
        {
          name: "egress",
          image: EGRESS_IMAGE,
          imagePullPolicy: "IfNotPresent",
          command: [
            "sh",
            "-c",
            `cp ${CONFIG_DIR}/proxy.yaml ${PROXY_DIR}/proxy.yaml && exec sh ${CONFIG_DIR}/start.sh`,
          ],
          envFrom: [{ secretRef: { name } }],
          ports: [{ containerPort: EGRESS_PORT }],
          volumeMounts: mounts,
        },
      ],
      volumes: [
        { name: "state", emptyDir: {} },
        { name: "config", configMap: { name } },
        ...(files ? [{ name: "secrets", secret: { secretName: files } }] : []),
      ],
    },
  };
}

/** The Service the sandbox reaches its egress pod by. */
export function egressService(id: string): unknown {
  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: { name: egressName(id), labels: labels(id, "egress") },
    spec: { selector: labels(id, "egress"), ports: [{ port: EGRESS_PORT, targetPort: EGRESS_PORT }] },
  };
}

/** The ConfigMap with the egress proxy's CA, which the sandbox mounts next to CA_FILE. */
export function caConfig(id: string, certificate: string): unknown {
  return {
    apiVersion: "v1",
    kind: "ConfigMap",
    metadata: { name: caName(id), labels: labels(id, "egress") },
    data: { [CA_FILE.split("/").pop() as string]: certificate },
  };
}

/**
 * The sandbox's SandboxTemplate: the base pod with the spec's limits and environment in its first container,
 * `/workspace` as the working folder, the CA of the egress proxy, and a NetworkPolicy that lets the sandbox reach
 * only its egress pod and the cluster DNS.
 */
export function sandboxTemplate(id: string, spec: SandboxSpec, base: PodTemplate): unknown {
  const [first, ...others] = base.spec.containers as [Container, ...Container[]];
  const volumes = base.spec.volumes ?? [];
  const env = Object.entries(sandboxEnv(spec, egressUrl(id))).map(([name, value]) => ({ name, value }));
  const ours = [WORKSPACE, CA_FILE.slice(0, CA_FILE.lastIndexOf("/"))];
  const container: Container = {
    ...first,
    imagePullPolicy: first.imagePullPolicy ?? "IfNotPresent",
    command: ["sleep"],
    args: ["infinity"],
    workingDir: WORKSPACE,
    env: [...(first.env ?? []).filter((entry) => !env.some((own) => own.name === entry.name)), ...env],
    ...(limits(spec) ?? (first.resources ? { resources: first.resources } : {})),
    securityContext: { ...first.securityContext, allowPrivilegeEscalation: false },
    volumeMounts: [
      ...(first.volumeMounts ?? []).filter((mount) => !ours.includes(mount.mountPath)),
      { name: VOLUMES.workspace, mountPath: ours[0] as string },
      { name: VOLUMES.ca, mountPath: ours[1] as string, readOnly: true },
    ],
  };
  return {
    apiVersion: EXTENSIONS,
    kind: "SandboxTemplate",
    metadata: {
      name: sandboxName(id),
      labels: labels(id, "sandbox"),
      annotations: { [BASE_ANNOTATION]: JSON.stringify(base) },
    },
    spec: {
      podTemplate: {
        metadata: {
          labels: base.metadata?.labels ?? {},
          annotations: { ...base.metadata?.annotations, "kubectl.kubernetes.io/default-container": first.name },
        },
        spec: {
          ...base.spec,
          automountServiceAccountToken: false,
          containers: [container, ...others],
          volumes: [
            ...volumes.filter((volume) => volume.name !== VOLUMES.ca),
            ...(volumes.some((volume) => volume.name === VOLUMES.workspace)
              ? []
              : [{ name: VOLUMES.workspace, emptyDir: {} }]),
            { name: VOLUMES.ca, configMap: { name: caName(id) } },
          ],
        },
      },
      networkPolicy: {
        ingress: [],
        egress: [
          {
            to: [{ podSelector: { matchLabels: labels(id, "egress") } }],
            ports: [{ protocol: "TCP", port: EGRESS_PORT }],
          },
          {
            to: [
              {
                namespaceSelector: { matchLabels: { "kubernetes.io/metadata.name": "kube-system" } },
                podSelector: { matchLabels: { "k8s-app": "kube-dns" } },
              },
            ],
            ports: [
              { protocol: "UDP", port: 53 },
              { protocol: "TCP", port: 53 },
            ],
          },
        ],
      },
    },
  };
}

/** The spec's CPU and memory as requests and limits, or undefined when it names neither. */
function limits(spec: SandboxSpec): { resources: Record<string, unknown> } | undefined {
  const amounts = {
    ...(spec.cpu === undefined ? {} : { cpu: String(spec.cpu) }),
    ...(spec.memory === undefined ? {} : { memory: spec.memory }),
  };
  return Object.keys(amounts).length ? { resources: { requests: amounts, limits: amounts } } : undefined;
}

/** A warm pool without replicas, which a SandboxClaim needs, and the claim that starts the sandbox cold. */
export function claim(id: string): unknown[] {
  const name = sandboxName(id);
  return [
    {
      apiVersion: EXTENSIONS,
      kind: "SandboxWarmPool",
      metadata: { name, labels: labels(id, "sandbox") },
      spec: { replicas: 0, sandboxTemplateRef: { name } },
    },
    {
      apiVersion: EXTENSIONS,
      kind: "SandboxClaim",
      metadata: { name, labels: labels(id, "sandbox") },
      spec: { warmPoolRef: { name } },
    },
  ];
}

/** Several objects as one document for `kubectl apply -f -`. */
export const list = (items: unknown[]): unknown => ({ apiVersion: "v1", kind: "List", items });
