// The LiteLLM config a gateway runs: the user's config plus the master key, the database and frequent spend writes.
import { check } from "@opensoftware/cli";
import { parse, stringify } from "yaml";

/**
 * LiteLLM's reference to a variable of its process, such as "os.environ/OSF_SECRET_OPENAI_API_KEY". Only the prefix
 * of the secrets port's env provider passes, so a config cannot name any other variable of the adapter.
 */
const REFERENCE = /^os\.environ\/(OSF_SECRET_[A-Za-z0-9_]+)$/;

export interface GatewayConfig {
  /** The YAML the LiteLLM container reads. */
  text: string;
  /** The variables the config names; the adapter hands each to the container from its own environment. */
  variables: string[];
}

export function gatewayConfig(text: string): GatewayConfig {
  const config = (parse(text) ?? {}) as Record<string, unknown>;
  const general = (config.general_settings ?? {}) as Record<string, unknown>;
  // Spend rows reach the database every one to six seconds instead of every ten to fifteen.
  config.general_settings = { ...general, master_key: "os.environ/LITELLM_MASTER_KEY", proxy_batch_write_at: 1 };
  const variables = new Set<string>();
  JSON.stringify(config, (_key, value) => {
    const name = typeof value === "string" ? REFERENCE.exec(value)?.[1] : undefined;
    if (name) variables.add(name);
    return value;
  });
  return { text: stringify(config), variables: [...variables] };
}

/** A LiteLLM proxy that already runs, as `osf.proxy` of a config names it. */
export interface RunningProxy {
  /** The proxy's origin, such as http://litellm:4000. */
  origin: string;
  /** The adapter's variable that holds the proxy's master key, such as OSF_SECRET_LITELLM_MASTER_KEY. */
  masterKeyVariable: string;
}

/**
 * The proxy that `osf.proxy` of the config names, or undefined when the config has no `osf.proxy`. A master key that
 * is not a reference to an OSF_SECRET_ variable, or a URL that is not text, is a usage error.
 */
export function attachedProxy(text: string): RunningProxy | undefined {
  const config = (parse(text) ?? {}) as { osf?: { proxy?: { url?: unknown; master_key?: unknown } } };
  const proxy = config.osf?.proxy;
  if (proxy === undefined) return undefined;
  const reference = typeof proxy.master_key === "string" ? REFERENCE.exec(proxy.master_key) : null;
  check(reference, "osf.proxy.master_key names the master key's variable as os.environ/OSF_SECRET_<NAME>");
  check(typeof proxy.url === "string", "osf.proxy.url is the proxy's origin, like http://litellm:4000");
  return { origin: new URL(proxy.url).origin, masterKeyVariable: reference[1] as string };
}
