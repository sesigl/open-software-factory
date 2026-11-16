// Packs workspace packages for an image built from this commit (ADR 0076, ADR 0156): the named packages and the
// workspace packages they depend on, with `pnpm pack`. The deploy suite's module images and the e2e suite's one image
// both install these packs; npm `overrides` make each package take its sibling pack, not the release on npm.
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The root of the workspace. */
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

interface Manifest {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
}

/** Every package of the workspace by name. */
function workspace(): Map<string, Manifest> {
  const packages = new Map<string, Manifest>();
  const folders = [
    "modules",
    "packages",
    "contracts",
    ...readdirSync(join(ROOT, "adapters")).map((port) => `adapters/${port}`),
  ];
  for (const folder of folders) {
    const dirs =
      folder === "contracts" ? [join(ROOT, folder)] : readdirSync(join(ROOT, folder)).map((d) => join(ROOT, folder, d));
    for (const dir of dirs) {
      try {
        const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Manifest;
        packages.set(manifest.name, manifest);
      } catch {
        // A folder without a package, like a port's features.
      }
    }
  }
  return packages;
}

/**
 * Packs the packages `names` and the workspace packages they depend on, transitively, into `<context>/packs`, and
 * returns each packed package with its pack as `file:./packs/<file>`, for a package.json in `context`.
 */
export function packWorkspace(names: string[], context: string): Record<string, string> {
  const packages = workspace();
  const closure = new Set<string>();
  const visit = (name: string) => {
    if (closure.has(name)) return;
    const manifest = packages.get(name);
    if (!manifest) throw new Error(`packs: no workspace package ${name}`);
    closure.add(name);
    for (const [dependency, range] of Object.entries(manifest.dependencies ?? {}))
      if (range.startsWith("workspace:")) visit(dependency);
  };
  for (const name of names) visit(name);
  const sorted = [...closure].sort();
  const packs = join(context, "packs");
  mkdirSync(packs, { recursive: true });
  execFileSync("pnpm", [...sorted.flatMap((name) => ["--filter", name]), "pack", "--pack-destination", packs], {
    cwd: ROOT,
    stdio: ["ignore", "ignore", "inherit"],
  });
  const file = (name: string) =>
    `file:./packs/${name.replace("@", "").replace("/", "-")}-${(packages.get(name) as Manifest).version}.tgz`;
  return Object.fromEntries(sorted.map((name) => [name, file(name)]));
}
