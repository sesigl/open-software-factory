// Secret references (ADR 0054, ADR 0055): `ref:<provider>/<name>`, resolved by the egress proxy and never in the
// sandbox. The adapter learns where each value comes from; only the proxy gets the value or the means to fetch it.
import type { SandboxSpec } from "@opensoftware/contracts";

/** A secret of the spec and where its value comes from. */
export type Secret =
  | { variable: string; provider: "file"; file: string }
  | { variable: string; provider: "env"; name: string }
  | { variable: string; provider: "openbao"; path: string };

/** What the adapter knows about its secret sources: its environment and, for files, which files exist. */
export interface SecretSettings {
  /** The adapter's environment, for OSF_SECRET_<NAME> and the OSF_OPENBAO_* variables. */
  env: Record<string, string | undefined>;
  /** The folder of the secret files, OSF_SECRETS_DIR. */
  secretsDir: string;
  /** Whether the file below the secrets folder exists. */
  exists: (file: string) => boolean;
}

const PROVIDERS = ["file", "env", "openbao"];
const VARIABLE = /^[A-Z_][A-Z0-9_]*$/;

/** The variable of the adapter that holds the value of `ref:env/<NAME>`. */
export const envVariable = (name: string): string => `OSF_SECRET_${name}`;

/** The spec's secrets with their sources, and why any of them cannot be resolved. */
export function secretsOf(spec: SandboxSpec, settings: SecretSettings): { secrets: Secret[]; problems: string[] } {
  const secrets: Secret[] = [];
  const problems: string[] = [];
  for (const [variable, reference] of Object.entries(spec.secrets ?? {})) {
    const [, provider = "", name = ""] = /^ref:([^/]+)\/(.+)$/.exec(reference) ?? [];
    const problem = (text: string) => problems.push(`secret "${variable}": ${text}`);
    if (!PROVIDERS.includes(provider)) {
      problem(`the provider "${provider}" is not supported; sandbox adapters support "file", "env" and "openbao"`);
    } else if (provider === "file") {
      if (name.split("/").includes("..")) problem(`the name "${name}" leaves OSF_SECRETS_DIR`);
      else if (!settings.exists(name))
        problems.push(`secret "${variable}" has no file "${name}" in ${settings.secretsDir}`);
      else secrets.push({ variable, provider, file: name });
    } else if (provider === "env") {
      if (!VARIABLE.test(name)) problem(`"${name}" is no variable name; use A to Z, 0 to 9 and _`);
      else if (settings.env[envVariable(name)] === undefined) problem(`needs the variable "${envVariable(name)}"`);
      else secrets.push({ variable, provider, name });
    } else if (!settings.env.OSF_OPENBAO_ADDR || !settings.env.OSF_OPENBAO_TOKEN) {
      problem(`needs "OSF_OPENBAO_ADDR" and "OSF_OPENBAO_TOKEN"`);
    } else {
      secrets.push({ variable, provider: "openbao", path: name });
    }
  }
  return { secrets, problems };
}

/**
 * The egress proxy's own variables: the value of each `env` secret under its name, and OpenBao's address and token
 * as the Vault client reads them. None of them goes into the sandbox.
 */
export function proxyEnv(secrets: Secret[], env: Record<string, string | undefined>): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const secret of secrets) {
    if (secret.provider === "env") variables[secret.name] = env[envVariable(secret.name)] as string;
    if (secret.provider === "openbao") {
      variables.VAULT_ADDR = env.OSF_OPENBAO_ADDR as string;
      variables.VAULT_TOKEN = env.OSF_OPENBAO_TOKEN as string;
    }
  }
  return variables;
}
