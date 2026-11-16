// ARCH: every module declares its layers in architecture.json, and its source files follow them.
import type { Context } from "./lib/context.ts";
import { cruised, unitSources } from "./lib/cruise.ts";
import { type Finding, lineOf } from "./lib/repo.ts";

interface Layer {
  name: string;
  /** Relative to the module root. A path that ends in `/` is a folder; any other path is one file. */
  paths: string[];
}

export async function arch(context: Context): Promise<Finding[]> {
  const { repo } = context;
  const findings: Finding[] = [];
  for (const [root, sources] of unitSources(repo)) {
    if (sources.length === 0) continue;
    const manifest = `${root}/package.json`;

    const declaration = `${root}/architecture.json`;
    if (!repo.exists(declaration)) {
      findings.push({ check: "ARCH", file: manifest, line: 1, message: "has no architecture.json" });
      continue;
    }
    const layers = parseLayers(repo.read(declaration));
    if (typeof layers === "string") {
      findings.push({ check: "ARCH", file: declaration, line: 1, message: layers });
      continue;
    }

    const layerOf = (file: string): number => {
      if (!file.startsWith(`${root}/`)) return -1;
      const local = file.slice(root.length + 1);
      return layers.findIndex((layer) =>
        layer.paths.some((path) => (path.endsWith("/") ? local.startsWith(path) : local === path)),
      );
    };
    const placed = sources.filter((file) => {
      if (layerOf(file) >= 0) return true;
      findings.push({ check: "ARCH", file, line: 1, message: `is in no layer of ${declaration}` });
      return false;
    });
    findings.push(...(await upwardImports(context, placed, layers, layerOf)));
  }
  return findings;
}

/** The layers, or what is wrong with the file. */
function parseLayers(text: string): Layer[] | string {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return `is not JSON: ${error instanceof Error ? error.message : String(error)}`;
  }
  const layers = (json as { layers?: unknown } | null)?.layers;
  const valid =
    Array.isArray(layers) &&
    layers.length > 0 &&
    layers.every(
      (layer) =>
        typeof layer?.name === "string" &&
        Array.isArray(layer.paths) &&
        layer.paths.length > 0 &&
        layer.paths.every((path: unknown) => typeof path === "string" && path.length > 0),
    );
  return valid ? (layers as Layer[]) : 'needs "layers": a list of { "name": string, "paths": [string, ...] }';
}

/** A file imports files of its own layer and of the layers listed after it, never of a layer listed before it. */
async function upwardImports(
  context: Context,
  files: string[],
  layers: Layer[],
  layerOf: (file: string) => number,
): Promise<Finding[]> {
  if (files.length === 0) return [];
  const listed = new Set(files);
  const result = await cruised(context);
  const findings: Finding[] = [];
  for (const module of result.modules) {
    if (!listed.has(module.source)) continue;
    const own = layerOf(module.source);
    for (const dependency of module.dependencies) {
      const target = layerOf(dependency.resolved);
      if (target < 0 || target >= own) continue;
      const text = context.repo.read(module.source);
      findings.push({
        check: "ARCH",
        file: module.source,
        line: lineOf(text, dependency.module),
        message: `layer ${layers[own]?.name} imports ${dependency.module} from layer ${layers[target]?.name} above it`,
      });
    }
  }
  return findings;
}
