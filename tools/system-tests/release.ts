// Shared steps of the RELEASE scenarios: a workspace with a published and a private module.
import { putAll } from "./repo.ts";

type Sut = Parameters<typeof putAll>[0] & {
  cli(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }>;
};

/** The package.json of a module; `private` leaves it out of npm. */
export const manifest = (name: string, version: string, isPrivate = false): string =>
  `${JSON.stringify({ name: `@opensoftware/${name}`, version, ...(isPrivate ? { private: true } : {}) }, null, 2)}\n`;

/** A workspace with the published module "demo" at 0.3.0, the private module "other" and empty release files. */
export const putModules = (sut: Sut): Promise<void> =>
  putAll(sut, {
    "pnpm-workspace.yaml": "packages:\n  - modules/*\n",
    "modules/demo/package.json": manifest("demo", "0.3.0"),
    "modules/other/package.json": manifest("other", "0.1.0", true),
    "release-please-config.json": '{ "packages": {} }\n',
    ".release-please-manifest.json": "{}\n",
  });

export const releaseFiles = (sut: Sut) => sut.cli(["release-files"]);
export const checkRelease = (sut: Sut) => sut.cli(["check", "RELEASE"]);
