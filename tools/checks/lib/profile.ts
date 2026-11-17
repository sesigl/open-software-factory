// The pins of the Compose profile and the Helm chart (ADR 0095): what `osf profile-pins` writes and PROFILE compares.
// Each `@opensoftware/<name>@<version>` of deploy/compose/compose.yaml is the workspace's version of that package. A
// module image whose packages change gets a new tag: the module's new version, or `<version>-r<n+1>` when only an
// adapter of it moved, as a published tag never changes. The chart's `images.*` take the same tags, and the chart's
// version moves by a patch when they change. The factories of deploy/ name the agents' template, an image of the
// profile, at the same tag (ADR 0096). The reference factory's workflows run each package at the workspace's version
// (ADR 0150). The build arguments of compose.yaml that name a tool of this repository, like PNPM_VERSION, hold its pin
// from package.json or tools/scaffold/install-tools.ts, and a new pin gives the image a new tag (ADR 0172).
import type { Repo } from "./repo.ts";
import { workspace } from "./workspace.ts";

export const COMPOSE = "deploy/compose/compose.yaml";
export const VALUES = "deploy/helm/osf/values.yaml";
export const CHART = "deploy/helm/osf/Chart.yaml";
export const FACTORIES = ["deploy/compose/factory/factory.yaml", "deploy/dogfood/factory/factory.yaml"];
/** The workflows of the reference factory that post its check `factory` (ADR 0150): they run packages at their pins. */
export const WORKFLOWS = [
  "deploy/compose/factory/.github/workflows/factory.yaml",
  "deploy/compose/factory/.forgejo/workflows/factory.yaml",
];
export const REGISTRY = "ghcr.io/sesigl/open-software-factory";

const PIN = /@opensoftware\/([a-z0-9-]+)@(\d+\.\d+\.\d+)/g;
const ESCAPED = REGISTRY.replaceAll(".", "\\.");
const IMAGE = new RegExp(`image: ${ESCAPED}/([a-z0-9-]+):(\\S+)`);
const TAG = /^(\d+\.\d+\.\d+)(?:-r(\d+))?$/;
/** A build argument of a service, like `        PNPM_VERSION: "10.28.0"`. */
const ARG = /^(\s+)([A-Z][A-Z0-9_]*): "?([^"\s]*)"?$/gm;
export const TOOLS = "tools/scaffold/install-tools.ts";

/**
 * The pins of this repository's tools by the build argument that takes each (ADR 0172): PNPM_VERSION is the version
 * of `packageManager` in package.json; LYCHEE_VERSION, LYCHEE_SHA256_AMD64 and LYCHEE_SHA256_ARM64 are lychee's version
 * and the SHA-256 of its builds linux-x64 and linux-arm64 in tools/scaffold/install-tools.ts.
 */
export function toolPins(repo: Repo): Map<string, string> {
  const found = new Map<string, string>();
  if (repo.exists("package.json")) {
    const { packageManager } = JSON.parse(repo.read("package.json")) as { packageManager?: string };
    const pnpm = /^pnpm@(\d+\.\d+\.\d+)/.exec(packageManager ?? "")?.[1];
    if (pnpm) found.set("PNPM_VERSION", pnpm);
  }
  if (!repo.exists(TOOLS)) return found;
  const text = repo.read(TOOLS);
  const start = text.indexOf('name: "lychee"');
  if (start < 0) return found;
  const next = text.indexOf('name: "', start + 1);
  const lychee = text.slice(start, next < 0 ? undefined : next);
  const version = /version: "([^"]+)"/.exec(lychee)?.[1];
  if (version) found.set("LYCHEE_VERSION", version);
  for (const [platform, name] of [
    ["linux-x64", "LYCHEE_SHA256_AMD64"],
    ["linux-arm64", "LYCHEE_SHA256_ARM64"],
  ] as const) {
    const sum = new RegExp(`"${platform}": \\{[^}]*sha256: "([0-9a-f]{64})"`).exec(lychee)?.[1];
    if (sum) found.set(name, sum);
  }
  return found;
}

export interface Pins {
  compose: string;
  values: string;
  chart: string;
  /** Each file that `osf profile-pins` writes, with its text as it writes it: the three above and the factories. */
  files: [string, string][];
  /** The tag of each module image, by module name. */
  tags: Map<string, string>;
}

/** The pins of one service of compose.yaml: its module image, if any, and the packages it installs. */
export interface Service {
  name: string;
  /** The first line of the service, 1-based. */
  line: number;
  image?: { module: string; tag: string };
  packages: Map<string, string>;
  /** Its lines `NAME: value` with an upper-case name: build arguments like PNPM_VERSION, and variables. */
  args: Map<string, string>;
  text: string;
}

/** The services of compose.yaml, each with its text. */
export function services(compose: string): Service[] {
  const lines = compose.split("\n");
  // Only the section services: volumes and secrets have entries at the same depth, some with a service's name.
  const section = lines.indexOf("services:");
  const after = lines.findIndex((line, index) => index > section && /^[a-z]/.test(line));
  const top = after < 0 ? lines.length : after;
  const starts = lines.flatMap((line, index) =>
    section >= 0 && index > section && index < top && /^ {2}[a-z0-9-]+:$/.test(line) ? [index] : [],
  );
  return starts.map((start, position) => {
    const end = starts[position + 1] ?? (top > start ? top : lines.length);
    const text = lines.slice(start, end).join("\n");
    const image = IMAGE.exec(text);
    return {
      name: (lines[start] as string).trim().slice(0, -1),
      line: start + 1,
      image: image ? { module: image[1] as string, tag: image[2] as string } : undefined,
      packages: new Map([...text.matchAll(PIN)].map((pin) => [pin[1] as string, pin[2] as string])),
      args: new Map([...text.matchAll(ARG)].map((arg) => [arg[2] as string, arg[3] as string])),
      text,
    };
  });
}

/** The key of a module in the chart's `images`: factory-spec is factorySpec. */
export const valuesKey = (module: string): string => module.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

/** The next tag of a module image whose packages changed. */
function nextTag(tag: string, module: string, before: Map<string, string>, after: Map<string, string>): string {
  const own = after.get(module);
  if (own && own !== before.get(module)) return own;
  const [, base, release] = TAG.exec(tag) ?? [];
  return base ? `${base}-r${Number(release ?? 0) + 1}` : tag;
}

/** compose.yaml, values.yaml and Chart.yaml as `osf profile-pins` writes them. */
export function pins(repo: Repo): Pins {
  const versions = new Map(workspace(repo).map((unit) => [unit.name.replace(/^@opensoftware\//, ""), unit.version]));
  const tools = toolPins(repo);
  let compose = repo.read(COMPOSE);
  const tags = new Map<string, string>();
  for (const service of services(compose)) {
    const after = new Map([...service.packages].map(([name, version]) => [name, versions.get(name) ?? version]));
    const pinned = (name: string, value: string) => tools.get(name) ?? value;
    const changed =
      [...after].some(([name, version]) => service.packages.get(name) !== version) ||
      [...service.args].some(([name, value]) => pinned(name, value) !== value);
    if (service.image && !tags.has(service.image.module)) {
      const { module, tag } = service.image;
      tags.set(module, changed ? nextTag(tag, module, service.packages, after) : tag);
    }
    if (changed) {
      const text = service.text
        .replace(PIN, (_pin, name: string) => `@opensoftware/${name}@${after.get(name)}`)
        .replace(ARG, (arg, indent: string, name: string, value: string) =>
          tools.has(name) ? `${indent}${name}: "${pinned(name, value)}"` : arg,
        );
      compose = compose.replace(service.text, () => text);
    }
  }
  for (const [module, tag] of tags) {
    compose = compose.replaceAll(new RegExp(`(image: ${ESCAPED}/${module}):\\S+`, "g"), `$1:${tag}`);
  }
  const before = repo.exists(VALUES) ? repo.read(VALUES) : "";
  let values = before;
  for (const [module, tag] of tags) {
    values = values.replace(new RegExp(`^(  ${valuesKey(module)}: )"[^"]*"$`, "m"), `$1"${tag}"`);
  }
  let chart = repo.exists(CHART) ? repo.read(CHART) : "";
  if (values !== before) {
    chart = chart.replace(/^version: (\d+)\.(\d+)\.(\d+)$/m, (_, major, minor, patch) => {
      return `version: ${major}.${minor}.${Number(patch) + 1}`;
    });
  }
  const files: [string, string][] = [
    [COMPOSE, compose],
    [VALUES, values],
    [CHART, chart],
  ];
  for (const factory of FACTORIES.filter((file) => repo.exists(file))) {
    let text = repo.read(factory);
    for (const [module, tag] of tags) {
      text = text.replaceAll(new RegExp(`(${ESCAPED}/${module}):[^\\s"']+`, "g"), `$1:${tag}`);
    }
    files.push([factory, text]);
  }
  for (const workflow of WORKFLOWS.filter((file) => repo.exists(file))) {
    const text = repo.read(workflow);
    const pinned = (_pin: string, name: string, version: string) =>
      `@opensoftware/${name}@${versions.get(name) ?? version}`;
    files.push([workflow, text.replace(PIN, pinned)]);
  }
  return { compose, values, chart, files, tags };
}
