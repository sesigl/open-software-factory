// The packages of pnpm-workspace.yaml, as the checks and the scaffold read them.
import { dirname } from "node:path";
import { parse } from "yaml";
import type { Repo } from "./repo.ts";

interface Manifest {
  name?: string;
  version?: string;
  private?: boolean;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface Unit {
  /** The folder of the package, relative to the root. */
  dir: string;
  name: string;
  version: string;
  /** Published to npm: every package that is not private. */
  published: boolean;
  declared: Set<string>;
  tested: boolean;
}

/** The packages of pnpm-workspace.yaml, with their names, versions and declared dependencies. */
export function workspace(repo: Repo): Unit[] {
  if (!repo.exists("pnpm-workspace.yaml")) return [];
  const globs = ((parse(repo.read("pnpm-workspace.yaml")) as { packages?: string[] }).packages ?? []).map(
    (glob) => `${glob}/package.json`,
  );
  return repo.match(...globs).map((file) => {
    const manifest = JSON.parse(repo.read(file)) as Manifest;
    return {
      dir: dirname(file),
      name: manifest.name ?? dirname(file),
      version: manifest.version ?? "",
      published: manifest.private !== true,
      declared: new Set([...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.devDependencies ?? {})]),
      tested: manifest.scripts?.["test:system"] !== undefined,
    };
  });
}

/** The name without its scope: `@opensoftware/forge-github` is `forge-github`. */
export const shortName = (name: string): string => name.split("/").at(-1) as string;
