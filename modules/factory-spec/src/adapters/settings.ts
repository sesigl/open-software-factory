// Settings from the environment that only rendering reads (README#configuration).
import type { KubernetesSettings } from "../domain/kubernetes.ts";

export function kubernetesSettings(): KubernetesSettings {
  return {
    inferenceUrl: process.env.FACTORY_INFERENCE_URL ?? "http://inference-gateway:4000/v1",
    sandboxImages: process.env.FACTORY_SANDBOX_IMAGES ?? "ghcr.io/sesigl/open-software-factory/sandbox",
  };
}

/** The URL every webhook of the factory delivers to. */
export function intakeUrl(): string | undefined {
  return process.env.FACTORY_INTAKE_URL;
}
