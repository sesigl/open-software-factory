// The objects of a snapshot (ADR 0055): a PersistentVolumeClaim with the files of /workspace, a writer pod that
// fills it, and a SandboxTemplate whose init container copies the files back into a new sandbox's /workspace.
import { WORKSPACE } from "@opensoftware/sandbox-egress";
import { snapshotName, VOLUMES } from "./names.ts";
import type { Container, PodTemplate } from "./pod.ts";
import { GRACE_SECONDS } from "./resources.ts";

/** The label of a snapshot's claim, writer pod and template. */
export const SNAPSHOT_LABEL = "osf.snapshot.id";

/** The writer and the restore container keep each file's owner and mode, which only root may set. */
const ROOT = { runAsUser: 0, runAsGroup: 0 };

/** Where the writer pod and the restore container mount the snapshot. */
export const SNAPSHOT_DIR = "/snapshot";

/** The writer pod of a snapshot; the files of /workspace stream into it with tar. */
export const writerName = (id: string): string => `${snapshotName(id)}-writer`;

export function snapshotVolume(id: string, size: string): unknown {
  return {
    apiVersion: "v1",
    kind: "PersistentVolumeClaim",
    metadata: { name: snapshotName(id), labels: { [SNAPSHOT_LABEL]: id } },
    spec: { accessModes: ["ReadWriteOnce"], resources: { requests: { storage: size } } },
  };
}

export function writerPod(id: string, image: string): unknown {
  return {
    apiVersion: "v1",
    kind: "Pod",
    metadata: { name: writerName(id), labels: { [SNAPSHOT_LABEL]: id } },
    spec: {
      automountServiceAccountToken: false,
      terminationGracePeriodSeconds: GRACE_SECONDS,
      containers: [
        {
          name: "writer",
          image,
          imagePullPolicy: "IfNotPresent",
          command: ["sleep", "infinity"],
          securityContext: ROOT,
          volumeMounts: [{ name: VOLUMES.snapshot, mountPath: SNAPSHOT_DIR }],
        },
      ],
      volumes: [{ name: VOLUMES.snapshot, persistentVolumeClaim: { claimName: snapshotName(id) } }],
    },
  };
}

/** The template a snapshot prints: the sandbox's base pod, which first copies the snapshot into /workspace. */
export function snapshotTemplate(id: string, base: PodTemplate): unknown {
  const [first] = base.spec.containers as [Container];
  const restore: Container = {
    name: "osf-restore",
    image: first.image,
    imagePullPolicy: first.imagePullPolicy ?? "IfNotPresent",
    command: ["sh", "-c", `cp -a ${SNAPSHOT_DIR}/. ${WORKSPACE}/`],
    securityContext: ROOT,
    volumeMounts: [
      { name: VOLUMES.snapshot, mountPath: SNAPSHOT_DIR, readOnly: true },
      { name: VOLUMES.workspace, mountPath: WORKSPACE },
    ],
  };
  // A snapshot of a sandbox that started from a snapshot restores only the newer one.
  const volumes = (base.spec.volumes ?? []).filter(
    (volume) => volume.name !== VOLUMES.snapshot && volume.name !== VOLUMES.workspace,
  );
  const inits = (base.spec.initContainers ?? []).filter((container) => container.name !== restore.name);
  return {
    apiVersion: "extensions.agents.x-k8s.io/v1beta1",
    kind: "SandboxTemplate",
    metadata: { name: snapshotName(id), labels: { [SNAPSHOT_LABEL]: id } },
    spec: {
      networkPolicyManagement: "Unmanaged",
      podTemplate: {
        ...base,
        spec: {
          ...base.spec,
          initContainers: [...inits, restore],
          volumes: [
            ...volumes,
            { name: VOLUMES.workspace, emptyDir: {} },
            { name: VOLUMES.snapshot, persistentVolumeClaim: { claimName: snapshotName(id), readOnly: true } },
          ],
        },
      },
    },
  };
}
