import { scenario } from "@opensoftware/testkit";
import { profile, words } from "./profile.ts";

/** Each command of a step that runs a package with npx: the package, its version, its arguments and its condition. */
function commands(workflow: string) {
  const steps = [
    ...workflow.matchAll(/^ {6}- (?:if: (\S+)\n {8})?run: npx --yes @opensoftware\/([a-z-]+)@(\S+) (.+)$/gm),
  ];
  return steps.map(([, when, name, version, args]) => ({ when: when ?? "", name, version, args }));
}

scenario("SCN-DIST-042", async ({ sut, fakes, given, when, then }) => {
  let compose: Awaited<ReturnType<typeof profile>>;
  await given('the Compose profile with every value of ".env.example" set in ".env"', async () => {
    compose = await profile(sut);
  });

  let github = "";
  let forgejo = "";
  await when(
    'the operator reads the workflows "factory" of the reference factory in ".github/workflows/" and ".forgejo/workflows/"',
    async () => {
      const files = fakes.fromRepository("deploy/compose/factory");
      github = files[".github/workflows/factory.yaml"] ?? "";
      forgejo = files[".forgejo/workflows/factory.yaml"] ?? "";
    },
  );

  await then('each runs on pull requests and on pushes to the branch "main"', async () => {
    const triggers = "\non:\n  pull_request:\n  push:\n    branches: [main]\n";
    expect(github).toContain(triggers);
    expect(forgejo).toContain(triggers);
  });

  await then('the job of GitHub\'s is named "factory", which is the name of its check', async () => {
    // The one job of the workflow, with its own name.
    expect([...github.matchAll(/^ {2}([a-z-]+):\n {4}name: (\S+)$/gm)].map((job) => [job[1], job[2]])).toEqual([
      ["factory", "factory"],
    ]);
  });

  await then(
    'the job of Forgejo\'s posts the commit status "factory" with "forge-forgejo check": "pending" first, then "success" or "failure"',
    async () => {
      const posts = commands(forgejo)
        .filter((command) => command.name === "forge-forgejo")
        .map((command) => [command.when, command.args]);
      expect(posts).toEqual([
        ["", 'check "$REPOSITORY" "$SHA" factory pending --url "$RUN"'],
        ["success()", 'check "$REPOSITORY" "$SHA" factory success --url "$RUN"'],
        ["failure()", 'check "$REPOSITORY" "$SHA" factory failure --url "$RUN"'],
      ]);
    },
  );

  await then(
    'each runs "factory lint" and "factory plan --check" with "@opensoftware/factory-spec" at the version that the profile\'s service "factory" pins',
    async () => {
      const config = await compose.run(["--profile", "tools", "config", "--format", "json"]);
      expect(config.exitCode, config.stderr).toBe(0);
      const image = (JSON.parse(config.stdout) as { services: Record<string, { image: string }> }).services.factory
        ?.image;
      const pinned = /:(\d+\.\d+\.\d+)(?:-r\d+)?$/.exec(image ?? "")?.[1];
      for (const workflow of [github, forgejo]) {
        const spec = commands(workflow).filter((command) => command.name === "factory-spec");
        expect(spec.map((command) => [command.version, command.args])).toEqual([
          [pinned, "lint"],
          [pinned, "plan --check"],
        ]);
      }
    },
  );

  await then(
    '"docker compose run --rm factory lint" and "docker compose run --rm factory plan --check" exit with code 0 on the reference factory',
    async () => {
      for (const command of ["docker compose run --rm factory lint", "docker compose run --rm factory plan --check"]) {
        const run = await compose.run(words(command));
        expect(run.exitCode, `${command}: ${run.stdout}${run.stderr}`).toBe(0);
      }
    },
  );
});
