// The forge webhooks of forgejo and github automations through the forge port (ADR 0060): apply registers, updates
// and removes them; plan reports drift.
import type { FactoryDefinition } from "@opensoftware/contracts";
import { type Forge, forgeAdapter, type Hook } from "../adapters/forge.ts";
import { type WebhookSource, webhookTargets } from "../domain/automations.ts";
import { diff } from "../domain/diff.ts";
import { fail } from "../domain/errors.ts";

/** The recorded webhooks by key: "<owner>/<name>" on Forgejo, "github:<owner>/<name>" on GitHub. */
type Recorded = Record<string, Hook>;

const keyOf = (source: WebhookSource, repository: string): string =>
  source === "github" ? `github:${repository}` : repository;

const parseKey = (key: string): { source: WebhookSource; repository: string } =>
  key.startsWith("github:") ? { source: "github", repository: key.slice(7) } : { source: "forgejo", repository: key };

/** The adapter of each forge, started on first use with the forge's documented variables. */
function forges(secret: () => string | undefined = () => undefined): (source: WebhookSource) => Forge {
  const made = new Map<WebhookSource, Forge>();
  const env = process.env;
  const settings = (source: WebhookSource) =>
    source === "github"
      ? {
          command: env.FACTORY_GITHUB_ADAPTER ?? "npx -y @opensoftware/forge-github",
          url: env.FACTORY_GITHUB_URL ?? "https://api.github.com",
          token:
            env.FACTORY_GITHUB_TOKEN ?? fail("set FACTORY_GITHUB_TOKEN to manage the webhooks of github automations"),
          secret: secret(),
        }
      : {
          command: env.FACTORY_FORGEJO_ADAPTER ?? "npx -y @opensoftware/forge-forgejo",
          url: env.FACTORY_FORGE_URL ?? fail("set FACTORY_FORGE_URL to manage the webhooks of forgejo automations"),
          token:
            env.FACTORY_FORGE_TOKEN ?? fail("set FACTORY_FORGE_TOKEN to manage the webhooks of forgejo automations"),
          secret: secret(),
        };
  return (source) => {
    const forge = made.get(source) ?? forgeAdapter(settings(source));
    made.set(source, forge);
    return forge;
  };
}

/** Makes each forge hold the webhooks the definition needs and returns them by key. */
export async function applyWebhooks(
  definition: FactoryDefinition,
  recorded: Recorded = {},
  ghAw = false,
): Promise<Recorded> {
  const targets = webhookTargets(definition, ghAw);
  if (targets.length === 0 && Object.keys(recorded).length === 0) return {};
  const forge = forges(() =>
    targets.length === 0
      ? undefined
      : (process.env.FACTORY_WEBHOOK_SECRET ??
        fail("set FACTORY_WEBHOOK_SECRET to the secret that signs the webhooks of automations")),
  );
  const hooks: Recorded = {};
  for (const { source, repository, events } of targets) {
    const api = forge(source);
    const url = process.env.FACTORY_INTAKE_URL ?? fail("set FACTORY_INTAKE_URL, the address that receives webhooks");
    const key = keyOf(source, repository);
    const current = (await api.hooks(repository)).find((hook) => hook.id === recorded[key]?.id);
    // A person pointed the recorded webhook elsewhere: remove it, so the intake URL is registered once.
    if (current && current.url !== url) await api.unhook(repository, current.id);
    hooks[key] = await api.webhook(repository, url, events);
  }
  for (const [key, hook] of Object.entries(recorded)) {
    if (hooks[key]) continue;
    const { source, repository } = parseKey(key);
    await forge(source).unhook(repository, hook.id);
  }
  return hooks;
}

/** One "!" line per recorded webhook that the forge changed or deleted. */
export async function webhookDrift(recorded: Recorded = {}): Promise<string[]> {
  const forge = forges();
  const lines: string[] = [];
  for (const [key, hook] of Object.entries(recorded)) {
    const { source, repository } = parseKey(key);
    const current = (await forge(source).hooks(repository)).find((listed) => listed.id === hook.id);
    const fields = ({ url, events, active }: Hook) => ({ url, events: [...events].sort(), active });
    lines.push(
      ...(current
        ? diff(fields(hook), fields(current), `webhook ${key}`).map((line) => `!${line.slice(1)}`)
        : [`! webhook ${key} was deleted outside "factory apply"`]),
    );
  }
  return lines;
}
