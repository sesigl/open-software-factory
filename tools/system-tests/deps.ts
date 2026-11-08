// Shared step bodies of the DEPS scenarios: a workspace with the module "demo" and a pnpm lockfile in which "demo"
// depends on "pair", which needs its peer "base" at an exact version.
import { putAll } from "./repo.ts";

type Sut = Parameters<typeof putAll>[0] & {
  cli(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }>;
};

export interface Lock {
  /** The version of "base" that "demo" depends on, or none. */
  base?: string;
  /** Whether "pair" also needs the optional peer "extra" at 3.0.0. */
  extra?: boolean;
}

/** The lockfile and the manifest of "demo"; the manifest is one line, so each finding is on line 1. */
export function lockedRepository({ base, extra = false }: Lock): Record<string, string> {
  const dependencies: Record<string, string> = { pair: "1.0.0", ...(base ? { base } : {}) };
  const lock = [
    "lockfileVersion: '9.0'",
    "importers:",
    "  modules/demo:",
    "    dependencies:",
    "      pair:",
    "        specifier: 1.0.0",
    `        version: 1.0.0${base ? `(base@${base})` : ""}`,
    ...(base ? ["      base:", `        specifier: ${base}`, `        version: ${base}`] : []),
    "packages:",
    "  pair@1.0.0:",
    "    peerDependencies:",
    "      base: 2.0.0",
    ...(extra ? ["      extra: 3.0.0", "    peerDependenciesMeta:", "      extra:", "        optional: true"] : []),
    "",
  ].join("\n");
  return {
    "pnpm-workspace.yaml": "packages:\n  - modules/*\n",
    "pnpm-lock.yaml": lock,
    "modules/demo/package.json": `${JSON.stringify({ name: "@opensoftware/demo", version: "0.1.0", dependencies })}\n`,
  };
}

export const putLocked = (sut: Sut, lock: Lock): Promise<void> => putAll(sut, lockedRepository(lock));

export const runDeps = (sut: Sut) => sut.cli(["check", "DEPS"]);
