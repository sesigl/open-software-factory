// Shared inputs of the scenarios of osf init, up and doctor (tools/features/setup.feature).
import type { Sut } from "@opensoftware/testkit";

export const EXAMPLE = "deploy/compose/.env.example";
export const ENV = "deploy/compose/.env";
export const COMPOSE = "deploy/compose/compose.yaml";
export const DOCKER_LOG = "$OUTPUT/docker.log";

/** A compose.yaml that requires POSTGRES_PASSWORD, as the profile's does. */
export const REQUIRES_PASSWORD =
  "services:\n  postgres:\n    environment:\n      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}\n";

/**
 * A fake docker in $INPUT: it appends its folder and arguments to $OUTPUT/docker.log, prints `output` and exits with
 * `code`. Returns the environment that makes osf run it.
 */
export async function fakeDocker(sut: Sut, output = "", code = 0): Promise<Record<string, string>> {
  const script = [
    "#!/bin/sh",
    'here=$(pwd -P); input=$(cd "$INPUT" && pwd -P)',
    'printf "%s|%s\\n" "${here#"$input"/}" "$*" >> "$OUTPUT/docker.log"',
    ...(output ? [`echo ${JSON.stringify(output)}`] : []),
    `exit ${code}`,
    "",
  ].join("\n");
  await sut.files.put("$INPUT/fake-docker", script, { executable: true });
  return { OSF_DOCKER: sut.files.path("$INPUT/fake-docker") };
}

/** The calls of the fake docker, as "<folder below $INPUT>|<arguments>". */
export async function dockerCalls(sut: Sut): Promise<string[]> {
  const log = await sut.files.read(DOCKER_LOG).catch(() => "");
  return log.split("\n").filter(Boolean);
}
