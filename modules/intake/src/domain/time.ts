// The time of the module: OSF_NOW, like 2026-01-01T00:00:00Z, when the testkit or a person fixes it, else the clock.

export function nowOf(fixed: string | undefined): number {
  return fixed ? Date.parse(fixed) : Date.now();
}

export function isoOf(at: number): string {
  return new Date(at).toISOString();
}
