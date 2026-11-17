import { type CliResult, type Compose, type FakeHttp, scenario } from "@opensoftware/testkit";
import { profile } from "./profile.ts";

/** The adapters under "providers" of both factories that "factory plan --adapters" pins, by port: name and package. */
const ADAPTERS: Record<string, [string, string]> = {
  harness: ["claude-code", "@opensoftware/harness-claude-code"],
  forge: ["github", "@opensoftware/forge-github"],
  inference: ["litellm", "@opensoftware/inference-litellm"],
};

/** The npm registry's packument path of a package: a scoped name keeps its "@" and encodes its "/". */
const packumentPath = (name: string) => `/${name.replace("/", "%2f")}`;

interface Lock {
  adapters?: Record<string, Record<string, { range: string; version: string }>>;
}

scenario("SCN-DIST-086", async ({ sut, fakes, given, when, then }) => {
  let installed: Record<string, string> = {};
  let npm: FakeHttp;
  const override = "$INPUT/npm.yaml";
  await given(
    'the npm registry is a fake that the service "factory" reaches as "host.docker.internal", with each adapter package that the profile\'s service "foreman" installs at that version, at "0.1.0" and at "1.0.0"',
    async () => {
      // The service "foreman" of compose.yaml, up to the next service, and the packages its image installs.
      const file = fakes.fromRepository("deploy/compose")["compose.yaml"] ?? "";
      const foreman = /\n {2}foreman:\n([\s\S]*?)\n {2}[a-z-]+:\n/.exec(file)?.[1] ?? "";
      installed = Object.fromEntries(
        [...foreman.matchAll(/(@opensoftware\/[a-z-]+)@(\d\S*)/g)].map((match) => [match[1], match[2]]),
      );
      const packages = Object.values(ADAPTERS).map(([, name]) => name);
      expect(Object.keys(installed)).toEqual(expect.arrayContaining(packages));
      const routes = packages.map((name) => {
        const versions = ["0.1.0", installed[name] as string, "1.0.0"];
        return {
          path: packumentPath(name),
          body: { name, versions: Object.fromEntries(versions.map((version) => [version, { name, version }])) },
        };
      });
      npm = await fakes.http(routes, { containers: true });
      // Docker Desktop knows the name; Linux needs it mapped to the host.
      await sut.files.put(
        override,
        ["services:", "  factory:", '    extra_hosts: ["host.docker.internal:host-gateway"]', ""].join("\n"),
      );
    },
  );

  let compose: Compose;
  await given('the Compose profile with every value of ".env.example" set in ".env"', async () => {
    compose = await profile(sut);
  });

  const file = () => ["--file", sut.files.path(override)];
  /** "docker compose run --rm factory plan --adapters" with the fake registry. */
  const planAdapters = (factory: Compose) =>
    factory.run([
      ...file(),
      "run",
      "--rm",
      "-e",
      `FACTORY_NPM_REGISTRY=${npm.containerUrl}/`,
      "factory",
      "plan",
      "--adapters",
    ]);
  /** The factory.lock that plan wrote into the volume "factory". */
  const lockOf = async (factory: Compose): Promise<Lock> => {
    const read = ["run", "--rm", "--no-deps", "-T", "--entrypoint", "cat", "factory", "/factory/factory.lock"];
    const lock = await factory.run([...file(), ...read]);
    return lock.exitCode === 0 ? (JSON.parse(lock.stdout) as Lock) : {};
  };
  let reference: CliResult;
  let dogfood: CliResult;
  const locks: Lock[] = [];
  await when(
    'the operator runs "docker compose run --rm factory plan --adapters" with "FACTORY_NPM_REGISTRY" set to the fake, and again with "FACTORY_DIR" set to "../dogfood/factory"',
    async () => {
      reference = await planAdapters(compose);
      locks.push(await lockOf(compose));
      const again = await profile(sut, undefined, { FACTORY_DIR: "../dogfood/factory" });
      dogfood = await planAdapters(again);
      locks.push(await lockOf(again));
    },
  );

  await then("both exit with code 0", async () => {
    expect(reference.exitCode, reference.stdout + reference.stderr).toBe(0);
    expect(dogfood.exitCode, dogfood.stdout + dogfood.stderr).toBe(0);
  });

  await then(
    'each "factory.lock" pins the harness "claude-code", the forge "github" and the inference "litellm" at the version that the profile\'s service "foreman" installs',
    async () => {
      const expected = Object.fromEntries(
        Object.entries(ADAPTERS).map(([port, [name, pkg]]) => [port, { [name]: installed[pkg] }]),
      );
      const pinned = locks.map((lock) =>
        Object.fromEntries(
          Object.entries(lock.adapters ?? {}).map(([port, pins]) => [
            port,
            Object.fromEntries(Object.entries(pins).map(([name, pin]) => [name, pin.version])),
          ]),
        ),
      );
      expect(pinned).toEqual([expected, expected]);
    },
  );
});
