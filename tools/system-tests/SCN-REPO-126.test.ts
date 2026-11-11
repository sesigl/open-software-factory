import { scenario } from "@opensoftware/testkit";
import { putProfile } from "./profile.ts";

scenario("SCN-REPO-126", async ({ sut, given, when, then }) => {
  let base = "";
  await given(
    'a base commit with a doc "docs/how-to/deploy.md" that covers "deploy/**" and a Compose profile and Helm chart that pin "demo" 0.2.0 as osf profile-pins writes them',
    async () => {
      await putProfile(sut);
      await sut.files.put("$INPUT/docs/how-to/deploy.md", "---\ncovers: [deploy/**]\n---\n\n# Deploy\n");
      base = await sut.git.commit("base");
    },
  );

  await given(
    `a change that sets the workspace's version of "demo" to 0.3.0, runs "osf profile-pins" and adds a comment to "deploy/compose/compose.yaml"`,
    async () => {
      await sut.files.put("$INPUT/modules/demo/package.json", '{"name":"@opensoftware/demo","version":"0.3.0"}\n');
      await sut.cli(["profile-pins"]);
      const compose = await sut.files.read("$INPUT/deploy/compose/compose.yaml");
      await sut.files.put("$INPUT/deploy/compose/compose.yaml", `# The local profile.\n${compose}`);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf docs-affected" against the base commit', async () => {
    run = await sut.cli(["docs-affected"], { env: { OSF_BASE: base } });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output names "docs/how-to/deploy.md" and "deploy/compose/compose.yaml"', async () => {
    expect(run.stdout).toContain(
      "DOCS-AFFECTED docs/how-to/deploy.md:1 covers changed paths (deploy/compose/compose.yaml",
    );
  });
});
