// What the status of a pod says about a sandbox that is starting: nothing yet, or why it will not start.

interface ContainerStatus {
  name: string;
  state?: { waiting?: { reason?: string; message?: string } };
}

export interface PodStatus {
  status?: {
    phase?: string;
    containerStatuses?: ContainerStatus[];
    initContainerStatuses?: ContainerStatus[];
  };
}

/** Waiting reasons after which a container does not start without a change to the pod. */
const STUCK = [
  "ErrImagePull",
  "ImagePullBackOff",
  "InvalidImageName",
  "CrashLoopBackOff",
  "CreateContainerError",
  "CreateContainerConfigError",
  "RunContainerError",
  "StartError",
];

/** Why the pod will not run, or undefined while it may still start. */
export function podProblem(pod: PodStatus): string | undefined {
  if (pod.status?.phase === "Failed") return "the pod failed";
  const statuses = [...(pod.status?.initContainerStatuses ?? []), ...(pod.status?.containerStatuses ?? [])];
  // A container that ends restarts and waits as CrashLoopBackOff, so the waiting reason says it all.
  for (const { name, state } of statuses) {
    const waiting = state?.waiting;
    if (waiting?.reason && STUCK.includes(waiting.reason)) {
      return `the container "${name}" is ${waiting.reason}${waiting.message ? `: ${waiting.message}` : ""}`;
    }
  }
  return undefined;
}
