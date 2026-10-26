// The time of the module: OSF_NOW, like 2026-01-01T00:00:00Z, when the testkit or a person fixes it, else the clock.

export const isoNow = (fixed: string | undefined): string => new Date(fixed ? Date.parse(fixed) : Date.now()).toISOString();
