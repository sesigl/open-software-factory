// Before each run of the system tests: remove the gateways that no running test can own any more. The mutation
// check (ADR 0037) reruns these tests once per mutant, several runs at a time. A mutant that breaks stop, or a run that is
// stopped at its timeout, leaves its LiteLLM and PostgreSQL running, and a few dozen of them exhaust the runner's
// memory. A test starts its gateway within its 180-second timeout, so a gateway older than 240 seconds is left over.
//
// It also fills the volume of LiteLLM's compiled Python files that each gateway uses, once, before the scenarios start
// their gateways side by side: otherwise each of the first gateways compiles LiteLLM itself, which is about half of a
// start's CPU time. The test proxy of system-tests/proxy/ names the volume as external, so that its
// "compose down --volumes" keeps it for the other scenarios.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const LEFT_OVER_MS = 240_000;

export default function prepareDocker(): void {
  compileLiteLLM();
  // A concurrent run can remove the same gateway first: a failed cleanup must not fail this run.
  try {
    removeOld();
  } catch {}
}

function removeOld(): void {
  const docker = (args: string[]) => execFileSync("docker", args, { encoding: "utf8" }).trim();
  const ids = docker(["ps", "--all", "--quiet", "--filter", "label=osf.inference.id"]).split("\n").filter(Boolean);
  if (ids.length === 0) return;
  const old = docker(["container", "inspect", "--format", "{{.Id}} {{.Created}}", ...ids])
    .split("\n")
    .map((line) => line.split(" "))
    .filter(([, created]) => Date.now() - Date.parse(created as string) > LEFT_OVER_MS)
    .map(([id]) => id as string);
  if (old.length > 0) docker(["rm", "--force", "--volumes", ...old]);
  docker(["network", "prune", "--force", "--filter", "label=osf.inference.id", "--filter", "until=4m"]);
}

/**
 * Imports LiteLLM's proxy with the gateways' cache volume, in the image of the test proxy and of start, when the
 * volume does not exist yet. A mutation run starts the tests once per mutant and finds the volume.
 */
function compileLiteLLM(): void {
  try {
    execFileSync("docker", ["volume", "inspect", "osf-inference-python"], { stdio: "ignore" });
    return;
  } catch {}
  const compose = readFileSync(new URL("system-tests/proxy/compose.yaml", import.meta.url), "utf8");
  const image = compose.match(/image: (ghcr\.io\/berriai\/litellm:\S+)/)?.[1];
  if (!image) throw new Error("system-tests/proxy/compose.yaml names no LiteLLM image");
  execFileSync("docker", ["volume", "create", "osf-inference-python"], { stdio: "ignore" });
  execFileSync(
    "docker",
    ["run", "--rm", "--workdir", "/app", "--env", "PYTHONPYCACHEPREFIX=/var/cache/osf-python"]
      .concat(["--volume", "osf-inference-python:/var/cache/osf-python", "--entrypoint", "/app/.venv/bin/python"])
      .concat([image, "-c", "import litellm.proxy.proxy_server"]),
    { stdio: "ignore" },
  );
}
