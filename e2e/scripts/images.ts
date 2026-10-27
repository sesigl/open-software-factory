// Builds the image osf-e2e:workspace of the end-to-end scenarios (ADR 0076): packs every module and adapter the
// factory runs, with the workspace packages they depend on, and installs the packs together in images/Dockerfile.
// The overrides make each package take its sibling pack, not the release on npm.
//   node scripts/images.ts    (in e2e/, after turbo built the packages)
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const IMAGE = "osf-e2e:workspace";

/** The programs of the factory: the modules of the Compose profile, their adapters and the agents' tools. */
const PROGRAMS = [
  "@opensoftware/gatekeeper",
  "@opensoftware/intake",
  "@opensoftware/foreman",
  "@opensoftware/console",
  "@opensoftware/factory-spec",
  "@opensoftware/observer",
  "@opensoftware/taskcapture",
  "@opensoftware/proof",
  "@opensoftware/channel-slack",
  "@opensoftware/forge-forgejo",
  "@opensoftware/forge-github",
  "@opensoftware/harness-acp",
  "@opensoftware/inference-litellm",
];

const e2e = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(e2e, "..");

interface Manifest {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
}

/** Every package of the workspace by name, with its folder. */
function workspace(): Map<string, { dir: string; manifest: Manifest }> {
  const packages = new Map<string, { dir: string; manifest: Manifest }>();
  const folders = ["modules", "packages", "contracts", ...readdirSync(join(root, "adapters")).map((p) => `adapters/${p}`)];
  for (const folder of folders) {
    const dirs = folder === "contracts" ? [join(root, folder)] : readdirSync(join(root, folder)).map((d) => join(root, folder, d));
    for (const dir of dirs) {
      try {
        const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Manifest;
        packages.set(manifest.name, { dir, manifest });
      } catch {
        // A folder without a package, like a port's features.
      }
    }
  }
  return packages;
}

/** The programs and the workspace packages they depend on, transitively. */
function closure(packages: ReturnType<typeof workspace>): string[] {
  const names = new Set<string>();
  const visit = (name: string) => {
    if (names.has(name)) return;
    const found = packages.get(name);
    if (!found) throw new Error(`images: no workspace package ${name}`);
    names.add(name);
    for (const [dependency, range] of Object.entries(found.manifest.dependencies ?? {}))
      if (range.startsWith("workspace:")) visit(dependency);
  };
  for (const name of PROGRAMS) visit(name);
  return [...names].sort();
}

export function buildImage(): void {
  const context = join(e2e, ".images");
  const packs = join(context, "packs");
  rmSync(context, { recursive: true, force: true });
  mkdirSync(packs, { recursive: true });
  const packages = workspace();
  const names = closure(packages);
  execFileSync("pnpm", [...names.flatMap((name) => ["--filter", name]), "pack", "--pack-destination", packs], {
    cwd: root,
    stdio: ["ignore", "ignore", "inherit"],
  });
  const file = (name: string) => {
    const { version } = (packages.get(name) as { manifest: Manifest }).manifest;
    return `file:./packs/${name.replace("@", "").replace("/", "-")}-${version}.tgz`;
  };
  const files = Object.fromEntries(names.map((name) => [name, file(name)]));
  const manifest = { name: "osf-e2e", private: true, dependencies: files, overrides: files };
  writeFileSync(join(context, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const ca = process.env.OSF_BUILD_CA || join(root, "deploy/images/no-ca.pem");
  const proxy = ["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY"].flatMap((name) =>
    process.env[name] ? ["--build-arg", `${name}=${process.env[name]}`] : [],
  );
  execFileSync(
    "docker",
    ["build", "--quiet", "--network", "host", "--secret", `id=ca,src=${ca}`, ...proxy, "--tag", IMAGE]
      .concat(["--file", join(e2e, "images/Dockerfile"), context]),
    { stdio: ["ignore", "ignore", "inherit"] },
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) buildImage();
