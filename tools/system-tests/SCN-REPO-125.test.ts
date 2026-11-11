import { scenario } from "@opensoftware/testkit";
import { putProfile } from "./profile.ts";

scenario("SCN-REPO-125", async ({ sut, given, when, then }) => {
  let base = "";
  await given(
    'a base commit with a doc "docs/how-to/deploy.md" that covers "deploy/**" and a Compose profile and Helm chart that pin "demo" 0.2.0 as osf profile-pins writes them',
    async () => {
      await putProfile(sut);
      await sut.files.put("$INPUT/docs/how-to/deploy.md", "---\ncovers: [deploy/**]\n---\n\n# Deploy\n");
      base = await sut.git.commit("base");
    },
  );

  await given(`a change that sets the workspace's version of "demo" to 0.3.0 and runs "osf profile-pins"`, async () => {
    await sut.files.put("$INPUT/modules/demo/package.json", '{"name":"@opensoftware/demo","version":"0.3.0"}\n');
    const pinned = await sut.cli(["profile-pins"]);
    expect(pinned.stdout).toContain("wrote deploy/compose/compose.yaml");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf docs-affected" against the base commit', async () => {
    run = await sut.cli(["docs-affected"], { env: { OSF_BASE: base } });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });
});
