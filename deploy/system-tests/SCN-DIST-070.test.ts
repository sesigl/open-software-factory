import { type CliResult, type Compose, scenario } from "@opensoftware/testkit";
import { profile } from "./profile.ts";

const COMMANDS = [
  "node --version",
  "pnpm --version",
  "git --version",
  "make --version | head -n 1",
  "lychee --version",
  "printenv TURBO_CONCURRENCY",
];

scenario("SCN-DIST-070", async ({ sut, given, when, then }) => {
  // test:system runs scripts/images.ts before the tests, so the image of dogfood-template is the commit's.
  let compose: Compose;
  await given(
    'the module images of the Compose profile built from this workspace with "node scripts/images.ts", at the tags that "compose.yaml" pins',
    async () => {
      compose = await profile(sut);
    },
  );

  let run: CliResult;
  await when(
    'the operator runs "node --version", "pnpm --version", "git --version", "make --version", "lychee --version" and "printenv TURBO_CONCURRENCY" in the service "dogfood-template" with "docker compose run --rm --no-deps"',
    async () => {
      run = await compose.run([
        ...["run", "--rm", "--no-deps", "--entrypoint", "sh", "dogfood-template"],
        ...["-c", COMMANDS.join(" && ")],
      ]);
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  const lines = () => run.stdout.trim().split("\n");
  await then(
    'the output names Node "v24.", pnpm at the build argument "PNPM_VERSION" of "dogfood-template", "git version", "GNU Make" and lychee at its build argument "LYCHEE_VERSION", one per line',
    async () => {
      // The pins as compose.yaml passes them to the build; PROFILE keeps them equal to package.json and make install's.
      const config = await compose.run(["--profile", "dogfood", "config", "--format", "json"]);
      expect(config.exitCode, config.stderr).toBe(0);
      const { services } = JSON.parse(config.stdout) as {
        services: Record<string, { build?: { args?: Record<string, string> } }>;
      };
      const args = services["dogfood-template"]?.build?.args ?? {};
      expect(args.PNPM_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
      expect(args.LYCHEE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
      const [node, pnpm, git, make, lychee] = lines();
      expect(node).toMatch(/^v24\.\d+\.\d+$/);
      expect(pnpm).toBe(args.PNPM_VERSION);
      expect(git).toMatch(/^git version \d/);
      expect(make).toMatch(/^GNU Make \d/);
      expect(lychee).toBe(`lychee ${args.LYCHEE_VERSION}`);
    },
  );

  await then(
    'turbo runs at most "4" tasks at a time, so the typechecks of "make check-fast" fit the sandbox\'s memory',
    async () => {
      expect(lines()[5]).toBe("4");
    },
  );
});
