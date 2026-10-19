// Text builders for the factories the system tests create. They only build strings; the tests put them into
// $INPUT through sut.files.

/** factory.yaml of the factory "web-app": providers and agents as YAML lines, two spaces below their key. */
export function factoryYaml(options: { providers?: string[]; agents: string[]; rest?: string[] }): string {
  const providers = options.providers ?? ["harness:", '  claude-code: "^2"'];
  return [
    "version: 1",
    "factory: web-app",
    "providers:",
    ...providers.map((line) => `  ${line}`),
    "agents:",
    ...options.agents.map((line) => `  ${line}`),
    ...(options.rest ?? []),
    "",
  ].join("\n");
}

/** The agent `name` on `harness` with the prompt agents/<name>.md and extra lines. */
export function agent(name: string, extra: string[] = [], harness = "claude-code", model = `routes/${name}`): string[] {
  return [
    `${name}:`,
    `  harness: ${harness}`,
    `  model: ${model}`,
    `  prompt: ./agents/${name}.md`,
    ...extra.map((line) => `  ${line}`),
  ];
}

export const prompt = (name: string): string => `# ${name}\n\nYou are the ${name} agent of web-app.\n`;

/** The MCP Registry's answer for every version of a server, with an npm package or a remote per version. */
export function registryVersions(name: string, versions: string[], remote?: string): unknown {
  const pkg = `@acme/${name.split("/").pop()}-mcp`;
  return {
    servers: versions.map((version) => ({
      server: {
        name,
        version,
        ...(remote
          ? { remotes: [{ type: "streamable-http", url: remote }] }
          : { packages: [{ registryType: "npm", identifier: pkg, version, transport: { type: "stdio" } }] }),
      },
      _meta: {},
    })),
    metadata: { count: versions.length },
  };
}

export const versionsPath = (name: string): string => `/v0.1/servers/${encodeURIComponent(name)}/versions`;

/** factory.lock pinning "registry:io.github.acme/tracker@1.4" to 1.4.2 and its npm package. */
export const TRACKER_LOCK = `${JSON.stringify(
  {
    version: 1,
    mcp: {
      "registry:io.github.acme/tracker@1.4": {
        name: "io.github.acme/tracker",
        version: "1.4.2",
        package: { registryType: "npm", identifier: "@acme/tracker-mcp", version: "1.4.2" },
      },
    },
  },
  null,
  2,
)}\n`;

/** The code blocks of a README whose fence names a file, for example ```yaml factory.yaml, by that file. */
export function readmeFiles(readme: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const match of readme.matchAll(/^```\w+ (\S+)\n([\s\S]*?)^```$/gm))
    files[match[1] as string] = match[2] as string;
  return files;
}
