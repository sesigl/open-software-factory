// `osf bundle <package>` (ADR 0079): builds a CLI package as one bundled file, so that each start loads one file
// instead of hundreds. src/cli.ts becomes dist/main.js with a source map to the sources, dist/cli.js turns on Node's
// compile cache and imports it, and dist/THIRD-PARTY-NOTICES.md lists the license of every package in the bundle.
import { chmodSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { build, type RolldownLog } from "rolldown";

const BIN = `#!/usr/bin/env node
// The bin of a bundled package (ADR 0079): Node's compile cache first, so that the bundle compiles once.
import { enableCompileCache } from "node:module";

enableCompileCache?.();
await import("./main.js");
`;

interface Bundled {
  name: string;
  version: string;
  license?: string;
  texts: string[];
}

export async function bundle(root: string, args: string[]): Promise<number> {
  const folder = args[0];
  if (!folder) return fail("Give a package: osf bundle <package>");
  const dir = resolve(folder);
  const label = relative(root, dir) || folder;
  const dist = join(dir, "dist");
  rmSync(dist, { recursive: true, force: true });

  const unresolved: string[] = [];
  const result = await build({
    input: join(dir, "src", "cli.ts"),
    cwd: dir,
    platform: "node",
    logLevel: "warn",
    // An import that the bundle cannot hold would fail only when a user runs the package.
    onLog(level, log: RolldownLog, handler) {
      if (log.code === "UNRESOLVED_IMPORT") unresolved.push(log.message);
      else handler(level, log);
    },
    output: { dir: dist, format: "esm", entryFileNames: "main.js", sourcemap: true, codeSplitting: false },
  });
  if (unresolved.length > 0) return fail(`the bundle of ${label} misses imports:\n${unresolved.join("\n")}`);

  const packages = new Map<string, Bundled>();
  for (const output of result.output) {
    if (output.type !== "chunk") continue;
    for (const id of output.moduleIds) {
      const found = packageOf(id);
      if (found) packages.set(`${found.name}@${found.version}`, found);
    }
  }
  const missing = [...packages.values()].filter((found) => !found.license && found.texts.length === 0);
  if (missing.length > 0) {
    return fail(
      missing.map((found) => `${found.name} ${found.version} in the bundle of ${label} has no license`).join("\n"),
    );
  }

  writeFileSync(join(dist, "THIRD-PARTY-NOTICES.md"), notices(label, [...packages.values()]));
  writeFileSync(join(dist, "cli.js"), BIN);
  chmodSync(join(dist, "cli.js"), 0o755);
  return 0;
}

/** The package in node_modules that holds the module `id`, or undefined for the repository's own code. */
function packageOf(id: string): Bundled | undefined {
  const marker = `${sep}node_modules${sep}`;
  if (!id.includes(marker)) return undefined;
  for (let dir = dirname(id); dir.includes(marker); dir = dirname(dir)) {
    const file = join(dir, "package.json");
    if (!existsSync(file)) continue;
    const manifest = JSON.parse(readFileSync(file, "utf8")) as {
      name?: string;
      version?: string;
      license?: unknown;
      licenses?: { type?: string }[];
    };
    // A package.json in a sub-folder, like dist/esm/package.json with only "type", is not the package's own.
    if (!manifest.name || !manifest.version) continue;
    const license =
      typeof manifest.license === "string"
        ? manifest.license
        : manifest.licenses?.map((entry) => entry.type).join(" OR ") || undefined;
    const texts = readdirSync(dir)
      .filter((entry) => /^(licen[cs]e|copying|notice)(\.|$)/i.test(entry))
      .sort()
      .map((entry) => readFileSync(join(dir, entry), "utf8"));
    return { name: manifest.name, version: manifest.version, license, texts };
  }
  return undefined;
}

function notices(label: string, packages: Bundled[]): string {
  const sections = packages
    .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
    .map((found) =>
      [`## ${found.name} ${found.version}`, "", `License: ${found.license ?? "see the text below"}`, "", ...found.texts]
        .join("\n")
        .trimEnd(),
    );
  return `# Third-party notices\n\nThe bundle of ${label} holds code of these packages, under their own licenses.\n\n${sections.join("\n\n")}\n`;
}

function fail(message: string): number {
  process.stderr.write(`osf bundle: ${message}\n`);
  return 1;
}
