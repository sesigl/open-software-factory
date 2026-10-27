// @ts-nocheck
// The time of the module: OSF_NOW, like 2026-01-01T00:00:00Z, when the testkit or a person fixes it, else the clock.

export const nowOf = (fixed: string | undefined): number => (fixed ? Date.parse(fixed) : Date.now());

export const isoOf = (at: number): string => new Date(at).toISOString();
