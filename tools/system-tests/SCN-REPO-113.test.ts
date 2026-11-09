import { scenario } from "@opensoftware/testkit";
import { type Profile, putProfile, runProfile } from "./profile.ts";

scenario("SCN-REPO-113", async ({ sut, given, when, then }) => {
  const profile: Profile = {};
  let base = "";
  await given(
    `a base commit with a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them`,
    async () => {
      await putProfile(sut, profile);
      base = await sut.git.commit("base");
    },
  );

  await given(`a change that adds the file "deploy/helm/osf/templates.yaml" to the chart`, async () => {
    await putProfile(sut, profile);
    await sut.files.put("$INPUT/deploy/helm/osf/templates.yaml", "kind: Service\n");
  });

  let run: Awaited<ReturnType<typeof runProfile>>;
  await when(`the developer runs "osf check PROFILE" against the base commit`, async () => {
    run = await runProfile(sut, base ? { OSF_BASE: base } : {});
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout).toBe(1);
  });

  await then(
    `the output contains "PROFILE deploy/helm/osf/Chart.yaml:1 deploy/helm/osf/templates.yaml changed, so the chart's version must change too"`,
    async () => {
      expect(run.stdout).toContain(
        `PROFILE deploy/helm/osf/Chart.yaml:1 deploy/helm/osf/templates.yaml changed, so the chart's version must change too`,
      );
    },
  );
});
