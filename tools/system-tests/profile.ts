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
}

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
  } = profile;
  const manifest = (name: string, version: string, tested = false) => {
    const scripts = tested ? { scripts: { "test:system": "vitest run" } } : {};
    const devDependencies = tested ? { devDependencies: { "@opensoftware/testkit": "workspace:*" } } : {};
    return `${JSON.stringify({ name: `@opensoftware/${name}`, version, ...scripts, ...devDependencies })}\n`;
  };
  return {
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
      "      args:",
      `        PACKAGES: "${pins}"`,
      "",
    ].join("\n"),
    "deploy/helm/osf/values.yaml": `images:\n  demo: "${chartTag}"\npostgres:\n  image: ${chartImage}\n`,
    "deploy/helm/osf/Chart.yaml": `name: osf\nversion: ${chartVersion}\n`,
    ".github/test-suites.yml": `- suite: deploy\n  filter: "@opensoftware/deploy"\n  pull: ${pull}\n`,
  };
}

export const putProfile = (sut: Sut, profile: Profile = {}): Promise<void> => putAll(sut, profileRepository(profile));

export const runProfile = (sut: Sut, env: Record<string, string> = {}) => sut.cli(["check", "PROFILE"], { env });
