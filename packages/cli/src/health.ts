// The answer of a server's GET /v1/health (ADR 0086), the model Health of contracts/: one check per system the server
// needs, each within 2 seconds.

const LIMIT_MS = 2000;

export interface Probe {
  name: string;
  /** Resolves when the system answers; rejects with what failed. */
  check(): Promise<void>;
  /** What to do when the check fails. */
  fix: string;
}

export interface Health {
  status: "ok" | "failing";
  checks: { name: string; ok: boolean; detail?: string }[];
}

/** Runs the probes at the same time; a probe that rejects or does not answer within 2 seconds fails. */
export async function healthOf(probes: Probe[]): Promise<Health> {
  const checks = await Promise.all(
    probes.map(async ({ name, check, fix }) => {
      let timer: NodeJS.Timeout | undefined;
      const late = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`no answer within ${LIMIT_MS / 1000} s`)), LIMIT_MS);
      });
      try {
        await Promise.race([check(), late]);
        return { name, ok: true as const };
      } catch (failure) {
        return { name, ok: false as const, detail: `${(failure as Error).message}: ${fix}` };
      } finally {
        clearTimeout(timer);
      }
    }),
  );
  return { status: checks.every(({ ok }) => ok) ? "ok" : "failing", checks };
}
