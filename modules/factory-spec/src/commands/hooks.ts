// The webhooks of "factory apply" and their drift in "factory plan" (ADR 0022).
import { type Forgejo, forgejo } from "../adapters/forgejo.ts";
import { intakeUrl } from "../adapters/settings.ts";
import { fail } from "../domain/errors.ts";
import { type Hook, hookDrift, wantedHooks } from "../domain/hooks.ts";
import type { Factory } from "./load.ts";

const forge = (): Forgejo => {
  const found = forgejo();
  return typeof found === "string" ? fail(found) : found;
};

/** Makes each repository carry the factory's webhook; returns the hooks to record and one line per repository. */
export async function applyHooks(
  factory: Factory,
  previous: Record<string, Hook> = {},
): Promise<{ hooks: Record<string, Hook>; lines: string[] }> {
  const wanted = wantedHooks(factory.definition);
  if (Object.keys(wanted).length === 0 && Object.keys(previous).length === 0) return { hooks: {}, lines: [] };
  const client = forge();
  const url = intakeUrl() ?? fail("set FACTORY_INTAKE_URL to the URL the webhooks deliver to");
  const hooks: Record<string, Hook> = {};
  const lines: string[] = [];
  for (const [repository, events] of Object.entries(wanted)) {
    const recorded = previous[repository];
    const existing = (recorded && (await client.get(repository, recorded.id))) ?? (await client.find(repository, url));
    hooks[repository] = await client.put(repository, { url, events }, existing?.id);
    lines.push(`webhook of ${repository}: ${existing ? "updated" : "created"}`);
  }
  for (const [repository, hook] of Object.entries(previous)) {
    if (Object.hasOwn(wanted, repository)) continue;
    await client.remove(repository, hook.id);
    lines.push(`webhook of ${repository}: deleted`);
  }
  return { hooks, lines };
}

/** One line per recorded webhook that the forge no longer has as recorded. */
export async function hookDrifts(recorded: Record<string, Hook> = {}): Promise<string[]> {
  if (Object.keys(recorded).length === 0) return [];
  const client = forge();
  const lines: string[] = [];
  for (const [repository, hook] of Object.entries(recorded))
    lines.push(...hookDrift(repository, hook, await client.get(repository, hook.id)));
  return lines;
}
