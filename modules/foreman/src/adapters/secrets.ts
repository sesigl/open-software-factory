// Whether a stage's secrets from a store have a value, through the secrets port (ADR 0139): the foreman runs the
// secrets adapter's `exists` for each one, which reads the secret's metadata only. The foreman never reads a value.
import type { StoreSecret } from "../domain/definition.ts";
import { adapterRun, lastLine } from "./program.ts";

/**
 * Why the stage cannot run: the first secret without a value, or the error of an adapter that could not say; none when
 * every secret has a value. `adapter` gives the command line of a provider's secrets adapter.
 */
export async function missingSecret(
  secrets: StoreSecret[],
  adapter: (provider: string) => string[],
  env: Record<string, string | undefined>,
): Promise<string | undefined> {
  for (const { reference, provider, name } of secrets) {
    const run = adapterRun("secrets", adapter(provider), env);
    const printed = await run("exists", name).catch((failure: Error) => failure);
    if (printed instanceof Error) return printed.message;
    if (!(JSON.parse(lastLine(printed)) as { exists: boolean }).exists)
      return `the secret "${reference}" has no value; store it and run again`;
  }
  return undefined;
}
