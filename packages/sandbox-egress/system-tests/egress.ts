// What the library's tests share: the shape of iron-proxy's configuration as the tests read it, and a secrets
// folder in $INPUT.
import type { Sut } from "@opensoftware/testkit";

export interface Config {
  transforms: { name: string; config: { domains?: string[]; secrets?: Swap[] } }[];
  mcp?: { servers: { name: string; rules: { host: string; paths: string[] }[]; tools: { name: string }[] }[] };
}

export interface Swap {
  source: Record<string, string>;
  proxy_value: string;
  rules: { host: string }[];
}

/** The transform of the configuration with that name. */
export const transform = (config: unknown, name: string) =>
  (config as Config).transforms.find((entry) => entry.name === name)?.config;

/** The folder of the secret files of the scenario, with the files it names. */
export async function secretsDir(sut: Sut, files: Record<string, string> = {}): Promise<string> {
  await sut.files.put("$INPUT/secrets/.keep", "");
  for (const [name, text] of Object.entries(files)) await sut.files.put(`$INPUT/secrets/${name}`, text);
  return sut.files.path("$INPUT/secrets");
}

/** What the call throws, or undefined when it returns. */
export function catching(call: () => unknown): unknown {
  try {
    call();
  } catch (error) {
    return error;
  }
  return undefined;
}
