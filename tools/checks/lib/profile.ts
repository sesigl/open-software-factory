// The pins of the Compose profile and the Helm chart (ADR 0095): what `osf profile-pins` writes and PROFILE compares.
// Each `@opensoftware/<name>@<version>` of deploy/compose/compose.yaml is the workspace's version of that package. A
// module image whose packages change gets a new tag: the module's new version, or `<version>-r<n+1>` when only an
// adapter of it moved, as a published tag never changes. The chart's `images.*` take the same tags, and the chart's
// version moves by a patch when they change.
import type { Repo } from "./repo.ts";
import { workspace } from "./workspace.ts";

export const COMPOSE = "deploy/compose/compose.yaml";
export const VALUES = "deploy/helm/osf/values.yaml";
export const CHART = "deploy/helm/osf/Chart.yaml";
export const REGISTRY = "ghcr.io/sesigl/open-software-factory";

const PIN = /@opensoftware\/([a-z0-9-]+)@(\d+\.\d+\.\d+)/g;
const ESCAPED = REGISTRY.replaceAll(".", "\\.");
const IMAGE = new RegExp(`image: ${ESCAPED}/([a-z0-9-]+):(\\S+)`);
const TAG = /^(\d+\.\d+\.\d+)(?:-r(\d+))?$/;

export interface Pins {
  compose: string;
  values: string;
  chart: string;
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
  text: string;
}

/** The services of compose.yaml, each with its text. */
export function services(compose: string): Service[] {
  const lines = compose.split("\n");
  const starts = lines.flatMap((line, index) => (/^ {2}[a-z0-9-]+:$/.test(line) ? [index] : []));
  const top = lines.findIndex((line, index) => index > (starts[0] ?? 0) && /^[a-z]/.test(line));
  return starts.map((start, position) => {
    const end = starts[position + 1] ?? (top > start ? top : lines.length);
    const text = lines.slice(start, end).join("\n");
    const image = IMAGE.exec(text);
    return {
      name: (lines[start] as string).trim().slice(0, -1),
      line: start + 1,
      image: image ? { module: image[1] as string, tag: image[2] as string } : undefined,
      packages: new Map([...text.matchAll(PIN)].map((pin) => [pin[1] as string, pin[2] as string])),
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
  let compose = repo.read(COMPOSE);
  const tags = new Map<string, string>();
  for (const service of services(compose)) {
    const after = new Map([...service.packages].map(([name, version]) => [name, versions.get(name) ?? version]));
    const changed = [...after].some(([name, version]) => service.packages.get(name) !== version);
    if (service.image && !tags.has(service.image.module)) {
      const { module, tag } = service.image;
      tags.set(module, changed ? nextTag(tag, module, service.packages, after) : tag);
    }
    if (changed) {
      const text = service.text.replace(PIN, (pin, name: string) => `@opensoftware/${name}@${after.get(name)}`);
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
  return { compose, values, chart, tags };
}
