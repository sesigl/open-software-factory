// Builds the module images of the Compose profile from this commit and tags them with the pins of compose.yaml (ADR
// 0156), so the deploy suite starts the code under review, not the last release. images/Dockerfile stays what
// publish-images builds from npm: this script writes a copy into images/.workspace in which the one step that installs
// PACKAGES from npm installs them from the workspace's packs (packs.ts, install.mjs). Every other line of the copy, its
// stages and its build arguments are the Dockerfile's own, and the targets are compose.yaml's, as publish-images bakes.
//   node scripts/images.ts    (in deploy/, after turbo built the packages; test:system runs it before the tests)
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { packWorkspace, ROOT } from "./packs.ts";

const deploy = join(ROOT, "deploy");
const compose = join(deploy, "compose");
const images = join(deploy, "images");
const context = join(images, ".workspace");

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

/** The bake targets of compose.yaml that install PACKAGES, one per image. */
function moduleTargets(env: NodeJS.ProcessEnv): string[] {
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
    if (image && definition.args?.PACKAGES && !byImage.has(image)) byImage.set(image, name);
  }
  return [...byImage.values()].sort();
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
      ...moduleTargets(env),
    ],
    { cwd: compose, env, stdio: ["ignore", "ignore", "inherit"] },
  );
}

if (process.argv[1] === import.meta.filename) buildImages();
