// The sandbox spec as the docker adapter applies it: memory in bytes, the secrets' files and the sandbox's
// environment, which holds placeholders and never a real secret.
import type { SandboxSpec } from "@opensoftware/contracts";
import { CA_FILE, EGRESS_URL } from "./names.ts";

const UNITS: Record<string, number> = { "": 1, Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4 };

/** A Kubernetes quantity such as "256Mi" in bytes, as `docker create --memory` takes it. */
export function memoryBytes(quantity: string): number {
  const [, amount, unit] = /^([0-9]+)(Ki|Mi|Gi|Ti)?$/.exec(quantity) ?? [];
  return Number(amount) * (UNITS[unit ?? ""] as number);
}

/** A secret of the spec: the variable in the sandbox and the file in OSF_SECRETS_DIR that holds the real value. */
export interface SecretFile {
  variable: string;
  file: string;
}

/**
 * The secrets of the spec as files, or the reason why one cannot be resolved. The docker adapter resolves only the
 * provider `file`: `ref:file/<name>` is `<name>` in OSF_SECRETS_DIR.
 */
export function secretFiles(spec: SandboxSpec): { files: SecretFile[]; problems: string[] } {
  const files: SecretFile[] = [];
  const problems: string[] = [];
  for (const [variable, reference] of Object.entries(spec.secrets ?? {})) {
    const [, provider, name] = /^ref:([^/]+)\/(.+)$/.exec(reference) ?? [];
    if (provider !== "file") {
      problems.push(
        `secret "${variable}": the provider "${provider}" is not supported; sandbox-docker supports "file"`,
      );
    } else if (name?.split("/").includes("..")) {
      problems.push(`secret "${variable}": the name "${name}" leaves OSF_SECRETS_DIR`);
    } else {
      files.push({ variable, file: name as string });
    }
  }
  return { files, problems };
}

/** The value the sandbox holds in place of a secret; the egress proxy swaps it for the real one. */
export const placeholder = (variable: string): string => `osf-secret-placeholder-${variable}`;

/** The sandbox's environment: the spec's variables, a placeholder per secret, the egress proxy and its CA. */
export function sandboxEnv(spec: SandboxSpec): Record<string, string> {
  const secrets = Object.keys(spec.secrets ?? {}).map((variable) => [variable, placeholder(variable)]);
  const proxy = ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"].map((name) => [name, EGRESS_URL]);
  const ca = ["SSL_CERT_FILE", "NODE_EXTRA_CA_CERTS", "REQUESTS_CA_BUNDLE", "CURL_CA_BUNDLE", "GIT_SSL_CAINFO"].map(
    (name) => [name, CA_FILE],
  );
  return { ...spec.env, ...Object.fromEntries([...secrets, ...proxy, ...ca]) };
}
