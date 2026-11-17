// Shared step bodies of the PROFILE and profile-pins scenarios: a workspace with the module "demo" and its adapter
// "adapter", the Compose profile with PostgreSQL and the image of demo, the Helm chart, and the suite "deploy", whose
// test starts the profile. Each field changes one place.
import { putAll } from "./repo.ts";

type Sut = Parameters<typeof putAll>[0] & {
  cli(args: string[], options?: { env?: Record<string, string> }): Promise<{ exitCode: number; stdout: string }>;
};

export interface Profile {
  /** The workspace's versions of demo and adapter. */
  demo?: string;
  adapter?: string;
  /** The tag of the image demo in compose.yaml, and its packages. */
  tag?: string;
  pins?: string;
  /** The chart's tag of demo, its PostgreSQL image and its version. */
  chartTag?: string;
  chartImage?: string;
  chartVersion?: string;
  /** The pull list of the suite deploy. */
  pull?: string;
  /** An image that only the testkit, a dependency of deploy, names. */
  testkitImage?: string;
  /** The target of deploy/images/Dockerfile that the image demo builds, and that Dockerfile. */
  target?: string;
  dockerfile?: string;
  /** A volume of compose.yaml with the name of the service demo. */
  volume?: boolean;
  /** The agents' template that the reference factory names. */
  template?: string;
  /** The tag of the image litellm that the profile builds, which the chart's LiteLLM uses too. */
  gateway?: string;
  /** The command that the reference factory's workflow "factory" runs. */
  workflow?: string;
  /** The packages of the profile that deploy/package.json declares besides the testkit; default demo and adapter. */
  declares?: string[];
  /** The packageManager of the root package.json, which is then written. */
  packageManager?: string;
  /** lychee's pins in tools/scaffold/install-tools.ts, which is then written. */
  lychee?: Lychee;
  /** Build arguments of the image demo after PACKAGES, from line 9 of compose.yaml on. */
  args?: Record<string, string>;
}

/** lychee's version and the SHA-256 of its builds linux-x64 and linux-arm64. */
export interface Lychee {
  version: string;
  x64: string;
  arm64: string;
}

/** tools/scaffold/install-tools.ts with its list of pinned tools: lychee, then oasdiff. */
function installTools({ version, x64, arm64 }: Lychee): string {
  const build = (platform: string, sha256: string) => [
    `      "${platform}": {`,
    `        url: "https://example.invalid/lychee-v${version}/lychee-${platform}.tar.gz",`,
    `        sha256: "${sha256}",`,
    "      },",
  ];
  return [
    "const PINNED: Pinned[] = [",
    "  {",
    '    name: "lychee",',
    `    version: "${version}",`,
    "    builds: {",
    ...build("linux-x64", x64),
    ...build("linux-arm64", arm64),
    "    },",
    "  },",
    "  {",
    '    name: "oasdiff",',
    '    version: "1.11.7",',
    "    builds: {",
    '      "linux-x64": {',
    '        url: "https://example.invalid/oasdiff_1.11.7_linux_amd64.tar.gz",',
    `        sha256: "${"0".repeat(64)}",`,
    "      },",
    "    },",
    "  },",
    "];",
    "",
  ].join("\n");
}

/** A Dockerfile whose stage demo builds on the stage base and the global ARG NODE. */
export const DOCKERFILE = [
  "ARG NODE=node:24",
  "FROM ${NODE} AS base",
  "RUN echo base",
  "FROM base AS demo",
  "RUN echo demo",
  "",
];

export const REGISTRY = "ghcr.io/sesigl/open-software-factory";

export function profileRepository(profile: Profile = {}): Record<string, string> {
  const {
    demo = "0.2.0",
    adapter = "0.3.0",
    tag = "0.2.0",
    pins = "@opensoftware/demo@0.2.0 @opensoftware/adapter@0.3.0",
    chartTag = "0.2.0",
    chartImage = "postgres:18-alpine",
    chartVersion = "0.1.0",
    pull = "postgres:18-alpine",
    testkitImage,
    target,
    dockerfile,
    volume = false,
    template,
    gateway,
    workflow,
    declares = ["demo", "adapter"],
    packageManager,
    lychee,
    args = {},
  } = profile;
  const manifest = (name: string, version: string, tested = false) => {
    const scripts = tested ? { scripts: { "test:system": "vitest run" } } : {};
    const own = Object.fromEntries(declares.map((declared) => [`@opensoftware/${declared}`, "workspace:*"]));
    const devDependencies = tested ? { devDependencies: { "@opensoftware/testkit": "workspace:*", ...own } } : {};
    return `${JSON.stringify({ name: `@opensoftware/${name}`, version, ...scripts, ...devDependencies })}\n`;
  };
  const root = { name: "root", private: true, packageManager };
  return {
    ...(packageManager ? { "package.json": `${JSON.stringify(root)}\n` } : {}),
    ...(lychee ? { "tools/scaffold/install-tools.ts": installTools(lychee) } : {}),
    "pnpm-workspace.yaml": "packages:\n  - modules/*\n  - deploy\n",
    "modules/demo/package.json": manifest("demo", demo),
    "modules/adapter/package.json": manifest("adapter", adapter),
    "modules/testkit/package.json": manifest("testkit", "0.1.0"),
    "modules/testkit/src/fakes.ts": `export const IMAGES = { s3: "${testkitImage ?? "chrislusf/seaweedfs:3.97"}" };\n`,
    "deploy/package.json": manifest("deploy", "0.1.0", true),
    "deploy/system-tests/SCN-DIST-001.test.ts": 'const compose = sut.compose("compose/compose.yaml");\n',
    "deploy/compose/compose.yaml": [
      "services:",
      "  postgres:",
      "    image: postgres:18-alpine",
      "  demo:",
      `    image: ${REGISTRY}/demo:${tag}`,
      "    build:",
      ...(target ? [`      target: ${target}`] : []),
      "      args:",
      `        PACKAGES: "${pins}"`,
      ...Object.entries(args).map(([name, value]) => `        ${name}: "${value}"`),
      ...(gateway
        ? ["  litellm:", `    image: ${REGISTRY}/litellm:${gateway}`, "    build:", "      target: litellm"]
        : []),
      ...(volume ? ["volumes:", "  demo:"] : []),
      "",
    ].join("\n"),
    ...(dockerfile ? { "deploy/images/Dockerfile": dockerfile } : {}),
    ...(template
      ? { "deploy/compose/factory/factory.yaml": `agents:\n  a:\n    sandbox:\n      template: ${template}\n` }
      : {}),
    ...(workflow
      ? { "deploy/compose/factory/.github/workflows/factory.yaml": `jobs:\n  factory:\n    - run: ${workflow}\n` }
      : {}),
    "deploy/helm/osf/values.yaml": `images:\n  demo: "${chartTag}"\npostgres:\n  image: ${chartImage}\n${
      gateway ? `litellm:\n  image: ${REGISTRY}/litellm:${gateway}\n` : ""
    }`,
    "deploy/helm/osf/Chart.yaml": `name: osf\nversion: ${chartVersion}\n`,
    ".github/test-suites.yml": `- suite: deploy\n  filter: "@opensoftware/deploy"\n  pull: ${pull}\n`,
  };
}

export const putProfile = (sut: Sut, profile: Profile = {}): Promise<void> => putAll(sut, profileRepository(profile));

export const runProfile = (sut: Sut, env: Record<string, string> = {}) => sut.cli(["check", "PROFILE"], { env });
