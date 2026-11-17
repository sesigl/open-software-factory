// Builds the module images of the Compose profile from this commit and tags them with the pins of compose.yaml (ADR
// 0156), so the deploy suite starts the code under review, not the last release. images/Dockerfile stays what
// publish-images builds from npm: this script writes a copy into images/.workspace in which the one step that installs
// PACKAGES from npm installs them from the workspace's packs (packs.ts, install.mjs). Every other line of the copy, its
// stages and its build arguments are the Dockerfile's own, and the targets are compose.yaml's, as publish-images bakes.
// When the current kube context is a local kind cluster, it then loads every image of the Helm chart into that cluster,
// so the chart's scenarios run the same images; the chart's pull policy IfNotPresent keeps them (T-72).
//   node scripts/images.ts              (in deploy/, after turbo built the packages; test:system runs it first)
//   node scripts/images.ts --dry-run    builds and loads nothing; prints what it would pull and load into kind
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { packWorkspace, ROOT } from "./packs.ts";

const deploy = join(ROOT, "deploy");
const compose = join(deploy, "compose");
const images = join(deploy, "images");
const context = join(images, ".workspace");
const chart = join(deploy, "helm/osf");
const bin = join(ROOT, ".tools/bin");

/** Each `@opensoftware/<name>` that a module image of compose.yaml installs. */
export function pinned(text: string): string[] {
  return [...new Set([...text.matchAll(/(@opensoftware\/[a-z0-9-]+)@\d+\.\d+\.\d+/g)].map((pin) => pin[1] as string))];
}

/** images/Dockerfile with its step `npm install --global ... $PACKAGES` replaced by the install from the packs. */
export function workspaceDockerfile(text: string): string {
  const lines = text.split("\n");
  const install = lines.findIndex((line) => line.includes("npm install --global") && line.includes("$PACKAGES"));
  let start = install;
  while (start > 0 && !(lines[start] as string).startsWith("RUN ")) start--;
  let end = install;
  while (end < lines.length - 1 && (lines[end] as string).endsWith("\\")) end++;
  if (install < 0 || !(lines[start] as string).startsWith("RUN ")) {
    throw new Error("images: deploy/images/Dockerfile has no step that runs npm install --global with $PACKAGES");
  }
  const step = [
    "COPY .workspace/package.json .workspace/install.mjs /opt/osf/",
    "COPY .workspace/packs/ /opt/osf/packs/",
    "RUN --mount=type=secret,id=ca,required=false \\",
    '  test -n "$PACKAGES" \\',
    "  && if [ -s /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi \\",
    "  && cd /opt/osf && node install.mjs $PACKAGES \\",
    "  && npm cache clean --force",
  ];
  return [...lines.slice(0, start), ...step, ...lines.slice(end + 1)].join("\n");
}

/** compose.yaml refuses to load without its secrets; building needs none of them. */
function bakeEnv(): NodeJS.ProcessEnv {
  const text = readFileSync(join(compose, "compose.yaml"), "utf8");
  const required = [...text.matchAll(/\$\{([A-Z_]+):\?/g)].map((variable) => variable[1] as string);
  return { ...Object.fromEntries(required.map((name) => [name, "unused"])), ...process.env };
}

/** The bake targets of compose.yaml by the image each builds; with `modules`, only those that install PACKAGES. */
function targets(env: NodeJS.ProcessEnv, modules: boolean): Map<string, string> {
  const printed = execFileSync("docker", ["buildx", "bake", "--file", "compose.yaml", "--print"], {
    cwd: compose,
    env,
    stdio: ["ignore", "pipe", "ignore"],
  });
  const { target } = JSON.parse(printed.toString()) as {
    target: Record<string, { tags?: string[]; args?: Record<string, string> }>;
  };
  const byImage = new Map<string, string>();
  for (const [name, definition] of Object.entries(target)) {
    const image = definition.tags?.[0];
    if (image && (!modules || definition.args?.PACKAGES) && !byImage.has(image)) byImage.set(image, name);
  }
  return byImage;
}

/** Bakes targets of compose.yaml from the copy of the Dockerfile in images/.workspace into Docker. */
function bake(names: string[], env: NodeJS.ProcessEnv): void {
  // Behind a proxy, the builds reach npm through it, as e2e/scripts/images.ts builds.
  const proxy = ["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY"].flatMap((name) =>
    process.env[name] ? ["--set", `*.args.${name}=${process.env[name]}`] : [],
  );
  const network = proxy.length > 0 ? ["--allow=network.host", "--set", "*.network=host"] : [];
  execFileSync(
    "docker",
    [
      ...["buildx", "bake", "--file", "compose.yaml", "--allow=fs.read=..", "--progress=quiet", "--load"],
      ...["--set", "*.dockerfile=.workspace/Dockerfile", ...network, ...proxy],
      ...names,
    ],
    { cwd: compose, env, stdio: ["ignore", "ignore", "inherit"] },
  );
}

export function buildImages(): void {
  rmSync(context, { recursive: true, force: true });
  mkdirSync(context, { recursive: true });
  const overrides = packWorkspace(pinned(readFileSync(join(compose, "compose.yaml"), "utf8")), context);
  const manifest = { name: "osf-deploy-image", private: true, overrides };
  writeFileSync(join(context, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  copyFileSync(join(deploy, "scripts/install.mjs"), join(context, "install.mjs"));
  writeFileSync(join(context, "Dockerfile"), workspaceDockerfile(readFileSync(join(images, "Dockerfile"), "utf8")));
  const env = bakeEnv();
  bake([...targets(env, true).values()].sort(), env);
}

/**
 * The images of the chart's pods with the improvement job on, and the agents' template of the reference factory that
 * foreman's sandboxes start: the module images, LiteLLM, PostgreSQL, NATS and Temporal's server and admin tools.
 */
export function chartImages(rendered: string, factory: string): string[] {
  const pods = [...rendered.matchAll(/^\s*image:\s*"?([^"\s]+)"?\s*$/gm)];
  const templates = [...factory.matchAll(/^\s+template:\s*(\S+)$/gm)];
  return [...new Set([...pods, ...templates].map((image) => image[1] as string))].sort();
}

/**
 * The kind cluster of the current kube context, by the rule of the testkit's sut.helm: kind names its contexts
 * `kind-<cluster>` and serves the API on the loopback address. Any other context, or none, is no kind cluster.
 */
function kindCluster(): string | undefined {
  const config = (args: string[]) =>
    spawnSync(join(bin, "kubectl"), ["config", ...args], { encoding: "utf8" }).stdout?.trim() ?? "";
  const name = config(["current-context"]);
  const server = config(["view", "--minify", "--output", "jsonpath={.clusters[0].cluster.server}"]);
  const host = URL.canParse(server) ? new URL(server).hostname : "";
  if (!name.startsWith("kind-") || !["127.0.0.1", "localhost", "[::1]"].includes(host)) return undefined;
  return name.slice("kind-".length);
}

/**
 * Loads the chart's images into the kind cluster of the current context. The module images are the commit's, which
 * buildImages tagged. An image that Docker does not have is pulled (CI pulls the suite's `pull` list before), or baked
 * when compose.yaml builds it and its registry does not have it yet, like a LiteLLM pin that moved.
 */
export function loadIntoKind(dryRun: boolean): void {
  const cluster = kindCluster();
  if (!cluster && !dryRun) {
    console.log("images: the kube context is no local kind cluster, so the chart's images are not loaded into kind");
    return;
  }
  const rendered = execFileSync(
    join(bin, "helm"),
    ["template", "osf", chart, "--set", "secrets.existingSecret=unused", "--set", "improve.enabled=true"],
    { stdio: ["ignore", "pipe", "ignore"] },
  ).toString();
  const list = chartImages(rendered, readFileSync(join(chart, "files/factory/factory.yaml"), "utf8"));
  const env = bakeEnv();
  for (const image of list) {
    if (spawnSync("docker", ["image", "inspect", image], { stdio: "ignore" }).status === 0) continue;
    console.log(`images: docker pull ${image}`);
    if (dryRun || spawnSync("docker", ["pull", "--quiet", image], { stdio: "ignore" }).status === 0) continue;
    const target = targets(env, false).get(image);
    if (!target) throw new Error(`images: ${image} of the chart is neither in Docker nor in its registry`);
    console.log(
      `images: ${image} is not in its registry yet, so it is baked from the target ${target} of compose.yaml`,
    );
    bake([target], env);
  }
  // One call: kind saves the images into one archive, so the layers they share go into the node once.
  const load = ["load", "docker-image", "--name", cluster ?? "kind", ...list];
  console.log(`images: kind ${load.join(" ")}${cluster ? "" : " (dry run: the kube context is no kind cluster)"}`);
  if (dryRun) return;
  const started = Date.now();
  execFileSync(join(bin, "kind"), load, { stdio: ["ignore", "ignore", "inherit"] });
  console.log(`images: ${list.length} images loaded into kind in ${Math.round((Date.now() - started) / 1000)} s`);
}

if (process.argv[1] === import.meta.filename) {
  const dryRun = process.argv.includes("--dry-run");
  if (!dryRun) buildImages();
  loadIntoKind(dryRun);
}
