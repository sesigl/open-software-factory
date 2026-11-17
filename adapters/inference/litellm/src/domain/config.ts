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

/** LiteLLM's proxy_batch_write_at when neither its config nor PROXY_BATCH_WRITE_AT sets it, in seconds. */
export const LITELLM_BATCH_WRITE_AT = 10;

/** The proxy_batch_write_at of a gateway that start runs: its spend rows are written every one to six seconds. */
export const STARTED_BATCH_WRITE_AT = 1;

/**
 * How long spend-log waits before it reads the spend rows of a proxy that writes them every `batchWriteAt` seconds.
 * LiteLLM writes its queue of spend rows every proxy_batch_write_at seconds plus zero to five, drawn when the proxy
 * starts, and has no way to write the queue now or to tell its size. Two more seconds cover the write itself.
 */
export function flushWaitMs(batchWriteAt: number): number {
  return (batchWriteAt + 5 + 2) * 1000;
}

export function gatewayConfig(text: string): GatewayConfig {
  const config = (parse(text) ?? {}) as Record<string, unknown>;
  const general = (config.general_settings ?? {}) as Record<string, unknown>;
  // Spend rows reach the database every one to six seconds instead of every ten to fifteen.
  const settings = { master_key: "os.environ/LITELLM_MASTER_KEY", proxy_batch_write_at: STARTED_BATCH_WRITE_AT };
  config.general_settings = { ...general, ...settings };
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
  /** The proxy's proxy_batch_write_at in seconds, as osf.proxy.proxy_batch_write_at names it, or LiteLLM's default. */
  batchWriteAt: number;
}

/**
 * The proxy that `osf.proxy` of the config names, or undefined when the config has no `osf.proxy`. A master key that
 * is not a reference to an OSF_SECRET_ variable, or a URL that is not text, is a usage error.
 */
export function attachedProxy(text: string): RunningProxy | undefined {
  const config = (parse(text) ?? {}) as {
    osf?: { proxy?: { url?: unknown; master_key?: unknown; proxy_batch_write_at?: unknown } };
  };
  const proxy = config.osf?.proxy;
  if (proxy === undefined) return undefined;
  const reference = typeof proxy.master_key === "string" ? REFERENCE.exec(proxy.master_key) : null;
  check(reference, "osf.proxy.master_key names the master key's variable as os.environ/OSF_SECRET_<NAME>");
  check(typeof proxy.url === "string", "osf.proxy.url is the proxy's origin, like http://litellm:4000");
  // LiteLLM's API does not tell its write interval, so the config names it when the proxy changes LiteLLM's default.
  const batchWriteAt = proxy.proxy_batch_write_at ?? LITELLM_BATCH_WRITE_AT;
  check(
    typeof batchWriteAt === "number" && batchWriteAt > 0,
    "osf.proxy.proxy_batch_write_at is the proxy's proxy_batch_write_at in seconds, like 10",
  );
  return { origin: new URL(proxy.url).origin, masterKeyVariable: reference[1] as string, batchWriteAt };
}
