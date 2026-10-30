// The Compose profile as the operator sets it up: every value of compose/.env.example set in $INPUT/.env.
import type { Compose, Sut } from "@opensoftware/testkit";

/** The values of `.env.example`, made up for the tests. */
const VALUES: Record<string, string> = {
  POSTGRES_PASSWORD: "postgres-password-1",
  LITELLM_MASTER_KEY: "sk-litellm-master-1",
  FOREMAN_API_TOKEN: "foreman-token-1",
  INTAKE_API_TOKEN: "intake-token-1",
  GATEKEEPER_API_TOKEN: "gatekeeper-token-1",
  GATEKEEPER_SLACK_TOKEN: "xoxb-gatekeeper-1",
  GATEKEEPER_SLACK_SIGNING_SECRET: "slack-signing-secret-1",
  GATEKEEPER_SLACK_CHANNEL: "C0GATES",
};

// Port 0 lets Docker pick free ports, so scenarios that run side by side do not collide.
const PORTS = [
  "CONSOLE_PORT",
  "INTAKE_PORT",
  "GATEKEEPER_PORT",
  "FOREMAN_PORT",
  "TEMPORAL_UI_PORT",
  "PHOENIX_PORT",
  "LITELLM_PORT",
];

/** Writes `.env` without the value `except` and with the values `more`, and returns the profile. */
export async function profile(sut: Sut, except?: string, more: Record<string, string> = {}): Promise<Compose> {
  const lines = Object.entries({ ...VALUES, ...more })
    .filter(([name]) => name !== except)
    .map(([name, value]) => `${name}=${value}`);
  await sut.files.put("$INPUT/.env", [...lines, ...PORTS.map((name) => `${name}=0`), ""].join("\n"));
  return sut.compose("compose/compose.yaml");
}

/** The words after "docker compose" in a step like 'the operator runs "docker compose up --detach --wait"'. */
export function words(command: string): string[] {
  return command.replace(/^docker compose /, "").split(" ");
}
