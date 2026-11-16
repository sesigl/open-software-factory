// Builds the image osf-e2e:workspace of the end-to-end scenarios (ADR 0076): packs every module and adapter the
// factory runs, with the workspace packages they depend on (deploy/scripts/packs.ts), and installs the packs together
// in images/Dockerfile. The overrides make each package take its sibling pack, not the release on npm.
//   node scripts/images.ts    (in e2e/, after turbo built the packages)
import { execFileSync } from "node:child_process";
import { copyFileSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HARNESS_AGENT } from "@opensoftware/testkit/harness-agent";
import { packWorkspace } from "../../deploy/scripts/packs.ts";

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
  "@opensoftware/sandbox-docker",
  "@opensoftware/secrets-openbao",
];

const e2e = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(e2e, "..");

export function buildImage(): void {
  const context = join(e2e, ".images");
  rmSync(context, { recursive: true, force: true });
  const files = packWorkspace(PROGRAMS, context);
  const manifest = { name: "osf-e2e", private: true, dependencies: files, overrides: files };
  writeFileSync(join(context, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  // The scripted agent, for the sandboxes that start from this image (ADR 0096); it finds the ACP SDK of harness-acp.
  copyFileSync(HARNESS_AGENT, join(context, "harness-agent.ts"));
  const ca = process.env.OSF_BUILD_CA || join(root, "deploy/images/no-ca.pem");
  const proxy = ["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY"].flatMap((name) =>
    process.env[name] ? ["--build-arg", `${name}=${process.env[name]}`] : [],
  );
  execFileSync(
    "docker",
    ["build", "--quiet", "--network", "host", "--secret", `id=ca,src=${ca}`, ...proxy, "--tag", IMAGE].concat([
      "--file",
      join(e2e, "images/Dockerfile"),
      context,
    ]),
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  gatewayImage();
}

/**
 * The profile's LiteLLM image (ADR 0098): on this machine, else pulled, else built from deploy/images/Dockerfile, as
 * before its first publish. A scenario that built it would spend its time budget on the build.
 */
function gatewayImage(): void {
  const compose = readFileSync(join(root, "deploy/compose/compose.yaml"), "utf8");
  const image = /image: (\S+\/litellm:\S+)/.exec(compose)?.[1];
  if (!image) throw new Error("no LiteLLM image in deploy/compose/compose.yaml");
  const docker = (...args: string[]) => {
    try {
      execFileSync("docker", args, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  };
  if (!docker("image", "inspect", image) && !docker("pull", "--quiet", image)) {
    execFileSync("docker", ["build", "--quiet", "--target", "litellm", "--tag", image, join(root, "deploy/images")], {
      stdio: ["ignore", "ignore", "inherit"],
    });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) buildImage();
