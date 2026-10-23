// The parts of a Kubernetes pod the adapter reads and writes. Everything else of a SandboxTemplate's pod passes
// through as it is.

export interface Container {
  name: string;
  image?: string;
  command?: string[];
  args?: string[];
  workingDir?: string;
  env?: { name: string; value?: string }[];
  resources?: Record<string, unknown>;
  volumeMounts?: { name: string; mountPath: string; readOnly?: boolean }[];
  imagePullPolicy?: string;
  securityContext?: Record<string, unknown>;
  [field: string]: unknown;
}

export interface PodSpec {
  containers: Container[];
  initContainers?: Container[];
  volumes?: { name: string; [source: string]: unknown }[];
  [field: string]: unknown;
}

/** The pod of a SandboxTemplate: its metadata (labels and annotations) and its spec. */
export interface PodTemplate {
  metadata?: { labels?: Record<string, string>; annotations?: Record<string, string> };
  spec: PodSpec;
}
