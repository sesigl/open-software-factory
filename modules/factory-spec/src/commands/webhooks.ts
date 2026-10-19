// The forge webhooks of forgejo automations: apply registers, updates and removes them; plan reports drift.
import type { FactoryDefinition } from "@opensoftware/contracts";
import { forgejo, type Hook } from "../adapters/forgejo.ts";
import { forgejoWebhook } from "../domain/automations.ts";
import { diff } from "../domain/diff.ts";
import { fail } from "../domain/errors.ts";

/** Makes the forge hold the webhooks the definition needs and returns them by repository. */
export async function applyWebhooks(
  definition: FactoryDefinition,
  recorded: Record<string, Hook> = {},
): Promise<Record<string, Hook>> {
  const { repositories, events } = forgejoWebhook(definition);
  if (repositories.length === 0 && Object.keys(recorded).length === 0) return {};
  const forge = forgejo();
  const hooks: Record<string, Hook> = {};
  for (const repository of repositories) {
    const url = process.env.FACTORY_INTAKE_URL ?? fail("set FACTORY_INTAKE_URL, the address that receives webhooks");
    const id = recorded[repository]?.id;
    const current = id === undefined ? undefined : await forge.get(repository, id);
    hooks[repository] = current
      ? await forge.update(repository, current.id, url, events)
      : await forge.create(repository, url, events);
  }
  for (const [repository, hook] of Object.entries(recorded)) {
    if (!hooks[repository]) await forge.remove(repository, hook.id);
  }
  return hooks;
}

/** One "!" line per recorded webhook that the forge changed or deleted. */
export async function webhookDrift(recorded: Record<string, Hook> = {}): Promise<string[]> {
  const entries = Object.entries(recorded);
  if (entries.length === 0) return [];
  const forge = forgejo();
  const lines: string[] = [];
  for (const [repository, hook] of entries) {
    const current = await forge.get(repository, hook.id);
    const fields = ({ url, events, active }: Hook) => ({ url, events, active });
    lines.push(
      ...(current
        ? diff(fields(hook), fields(current), `webhook ${repository}`).map((line) => `!${line.slice(1)}`)
        : [`! webhook ${repository} was deleted outside "factory apply"`]),
    );
  }
  return lines;
}
