// What the scenarios of a revoked key share: the foreman revokes the run's key just after the run ended, so a test
// reads the revokes of the fake inference adapter until there is one.
import type { Inference } from "@opensoftware/testkit";

/** The revokes of the fake inference adapter once there is one, after at most 10 seconds. */
export async function revokes(inference: Inference | undefined): Promise<{ gateway: string; run: string }[]> {
  const deadline = Date.now() + 10_000;
  while ((inference?.revoked().length ?? 0) === 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return inference?.revoked() ?? [];
}
