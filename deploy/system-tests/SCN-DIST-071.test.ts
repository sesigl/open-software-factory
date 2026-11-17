import { type CliResult, type Compose, scenario } from "@opensoftware/testkit";
import { profile, words } from "./profile.ts";

const AGENTS = ["triage", "spec", "implement", "review", "ship"];

interface Agent {
  prompt: string;
  sandbox?: { template?: string };
}

/** Prints each file under a line `=== <file>`, so one run reads every prompt. */
const PRINT = 'for file in "$@"; do echo "=== $file"; cat "$file"; done';

scenario("SCN-DIST-071", async ({ sut, given, when, then }) => {
  let compose: Compose;
  await given(
    'the Compose profile with every value of ".env.example" set in ".env" and "FACTORY_DIR" set to "../dogfood/factory"',
    async () => {
      compose = await profile(sut, undefined, { FACTORY_DIR: "../dogfood/factory" });
    },
  );

  let resolve: CliResult;
  let agents: Record<string, Agent> = {};
  let printed: CliResult;
  await when(
    'the operator runs "docker compose run --rm factory resolve" and prints each agent\'s prompt with "docker compose run --rm"',
    async () => {
      resolve = await compose.run(words("docker compose run --rm factory resolve"));
      expect(resolve.exitCode, resolve.stderr).toBe(0);
      // The first build of the image prints its log before the JSON.
      agents = (JSON.parse(resolve.stdout.slice(resolve.stdout.search(/^\{$/m))) as { agents: Record<string, Agent> })
        .agents;
      const files = AGENTS.map((name) => agents[name]?.prompt ?? `(no prompt of ${name})`);
      printed = await compose.run([
        ...["run", "--rm", "--no-deps", "--entrypoint", "sh", "factory", "-c", PRINT, "print"],
        ...files,
      ]);
      expect(printed.exitCode, printed.stderr).toBe(0);
    },
  );

  await then("the command exits with code 0", async () => {
    expect(resolve.exitCode, resolve.stderr).toBe(0);
  });

  await then(
    'the sandbox of each of the agents "triage", "spec", "implement", "review" and "ship" has the template that is the image of the service "dogfood-template"',
    async () => {
      const config = await compose.run(["--profile", "dogfood", "config", "--format", "json"]);
      expect(config.exitCode, config.stderr).toBe(0);
      const image = (JSON.parse(config.stdout) as { services: Record<string, { image?: string }> }).services[
        "dogfood-template"
      ]?.image;
      expect(image).toMatch(/\/dogfood-agent:/);
      expect(Object.fromEntries(AGENTS.map((name) => [name, agents[name]?.sandbox?.template]))).toEqual(
        Object.fromEntries(AGENTS.map((name) => [name, image])),
      );
    },
  );

  await then('each prompt names "make check-fast" and none names "make verify"', async () => {
    const parts = printed.stdout.split(/^=== /m).slice(1);
    expect(parts.map((part) => part.slice(0, part.indexOf("\n")))).toEqual(AGENTS.map((name) => agents[name]?.prompt));
    for (const part of parts) {
      expect(part).toContain("make check-fast");
      expect(part).not.toContain("make verify");
    }
  });
});
