// DEPS: dependencies that must change together (ADR 0094). A dependency that names an exact version of a peer, like
// @electric-sql/pglite-prepopulatedfs, which fits only its own PGlite version, needs that peer as a direct dependency of
// the same package at that version. Without the rule, an update of one of the two passes the install and fails only at
// run time. An optional peer, like vitest's @vitest/ui, must match only when the package declares it. The check reads
// pnpm-lock.yaml: the resolved versions of each package and the peers of each dependency.
import { parse } from "yaml";
import type { Context } from "./lib/context.ts";
import { type Finding, lineOf } from "./lib/repo.ts";

const ID = "DEPS";
const LOCKFILE = "pnpm-lock.yaml";
const EXACT = /^\d+\.\d+\.\d+$/;

interface Resolved {
  version?: string;
}

interface Lockfile {
  importers?: Record<string, { dependencies?: Record<string, Resolved>; devDependencies?: Record<string, Resolved> }>;
  packages?: Record<
    string,
    { peerDependencies?: Record<string, string>; peerDependenciesMeta?: Record<string, { optional?: boolean }> }
  >;
}

/** `0.5.11(@electric-sql/pglite@0.5.11)` is the version 0.5.11 with its peers. */
const versionOf = (resolved: Resolved): string => (resolved.version ?? "").replace(/\(.*$/, "");

export function deps(context: Context): Finding[] {
  const { repo } = context;
  if (!repo.exists(LOCKFILE)) return [];
  const lock = (parse(repo.read(LOCKFILE)) ?? {}) as Lockfile;
  const findings: Finding[] = [];
  for (const [dir, importer] of Object.entries(lock.importers ?? {})) {
    const direct = { ...importer.dependencies, ...importer.devDependencies };
    const manifest = dir === "." ? "package.json" : `${dir}/package.json`;
    for (const [name, resolved] of Object.entries(direct)) {
      const version = versionOf(resolved);
      const entry = lock.packages?.[`${name}@${version}`];
      for (const [peer, wanted] of Object.entries(entry?.peerDependencies ?? {})) {
        if (!EXACT.test(wanted)) continue;
        const own = direct[peer];
        if (own ? versionOf(own) === wanted : entry?.peerDependenciesMeta?.[peer]?.optional) continue;
        const has = own ? `has ${versionOf(own)}` : "does not declare it";
        const line = repo.exists(manifest) ? lineOf(repo.read(manifest), `"${name}"`) : 1;
        const message = `${name} ${version} needs ${peer} ${wanted} exactly; the package ${has}`;
        findings.push({ check: ID, file: manifest, line, message });
      }
    }
  }
  return findings;
}
