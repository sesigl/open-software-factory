// The spec's memory as Docker takes it: `docker create --memory` wants bytes, the spec a Kubernetes quantity.

const UNITS: Record<string, number> = { "": 1, Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4 };

/** A Kubernetes quantity such as "256Mi" in bytes. */
export function memoryBytes(quantity: string): number {
  const [, amount, unit] = /^([0-9]+)(Ki|Mi|Gi|Ti)?$/.exec(quantity) ?? [];
  return Number(amount) * (UNITS[unit ?? ""] as number);
}
