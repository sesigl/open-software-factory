import { type CliResult, type Compose, scenario } from "@opensoftware/testkit";
import { profile } from "./profile.ts";

const SERVICES = ["agent-template", "console", "factory", "foreman", "gatekeeper", "improve", "intake"];

/** A package of `npm ls --all --json`; a deduped one names only its version, without `resolved`. */
interface Listed {
  version?: string;
  resolved?: string;
  dependencies?: Record<string, Listed>;
}

/** Each `@opensoftware` package of the tree with its `resolved`, the copies that npm installed. */
function installed(tree: Listed): [string, Listed][] {
  return Object.entries(tree.dependencies ?? {}).flatMap(([name, entry]) => [
    ...(name.startsWith("@opensoftware/") && entry.resolved ? [[name, entry] as [string, Listed]] : []),
    ...installed(entry),
  ]);
}

scenario("SCN-DIST-053", async ({ sut, given, when, then }) => {
  // test:system runs scripts/images.ts before the tests, so the images are there; a scenario that built them would
  // spend its time budget on the build.
  let compose: Compose;
  await given(
    'the module images of the Compose profile built from this workspace with "node scripts/images.ts", at the tags that "compose.yaml" pins',
    async () => {
      compose = await profile(sut);
    },
  );

  const listed: Record<string, Listed> = {};
  const packages: Record<string, string> = {};
  await when(
    'the operator runs "npm ls --all --json" in "/opt/osf" of the services "agent-template", "console", "factory", "foreman", "gatekeeper", "improve" and "intake" with "docker compose run --rm --no-deps"',
    async () => {
      const config = await compose.run(["--profile", "tools", "--profile", "improve", "config", "--format", "json"]);
      expect(config.exitCode, config.stderr).toBe(0);
      const services = (
        JSON.parse(config.stdout) as { services: Record<string, { build?: { args?: Record<string, string> } }> }
      ).services;
      for (const service of SERVICES) {
        packages[service] = services[service]?.build?.args?.PACKAGES ?? "";
        const run: CliResult = await compose.run([
          ...["--profile", "tools", "--profile", "improve", "run", "--rm", "--no-deps"],
          ...["--workdir", "/opt/osf", "--entrypoint", "npm", service, "ls", "--all", "--json"],
        ]);
        // npm ls exits 1 on a problem of a third-party package's tree; the scenario reads only the packages it lists.
        expect(run.stdout, `${service}: ${run.stderr}`).toMatch(/^\{/);
        listed[service] = JSON.parse(run.stdout) as Listed;
      }
    },
  );

  await then(
    'each package of the service\'s "PACKAGES" is installed at the version that "compose.yaml" pins',
    async () => {
      for (const service of SERVICES) {
        const pins = (packages[service] as string).split(/\s+/).filter(Boolean);
        expect(pins.length, service).toBeGreaterThan(0);
        const top = listed[service]?.dependencies ?? {};
        for (const pin of pins) {
          const name = pin.slice(0, pin.lastIndexOf("@"));
          expect(`${name}@${top[name]?.version}`, service).toBe(pin);
        }
      }
    },
  );

  await then('every "@opensoftware" package in each image is resolved from a pack in "/opt/osf/packs"', async () => {
    for (const service of SERVICES) {
      const sources = installed(listed[service] as Listed).map(([name, entry]) => [name, entry.resolved]);
      expect(sources.length, service).toBeGreaterThan(0);
      for (const [name, resolved] of sources)
        expect(resolved, `${service}: ${name}`).toMatch(/^file:\/opt\/osf\/packs\//);
    }
  });
});
