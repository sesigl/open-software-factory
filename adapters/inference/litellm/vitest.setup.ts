// Before each run of the system tests: remove the gateways that no running test can own any more. The mutation
// check (ADR 0037) reruns these tests once per mutant, two runs at a time. A mutant that breaks stop, or a run that is
// stopped at its timeout, leaves its LiteLLM and PostgreSQL running, and a few dozen of them exhaust the runner's
// memory. A test starts its gateway within its 180-second timeout, so a gateway older than 240 seconds is left over.
import { execFileSync } from "node:child_process";

const LEFT_OVER_MS = 240_000;

export default function removeLeftOverGateways(): void {
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
