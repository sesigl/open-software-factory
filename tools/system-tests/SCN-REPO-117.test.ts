import { scenario } from "@opensoftware/testkit";
import { DOCKERFILE, type Profile, putProfile, runProfile } from "./profile.ts";

scenario("SCN-REPO-117", async ({ sut, given, when, then }) => {
  const profile: Profile = { target: "demo", dockerfile: DOCKERFILE.join("\n") };
  let base = "";
  await given(
    `a base commit with a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them, with the image of "demo" built from the target "demo" of "deploy/images/Dockerfile"`,
    async () => {
      await putProfile(sut, profile);
      base = await sut.git.commit("base");
    },
  );

  await given(
    `a change that adds a line to the stage "base" that the stage "demo" builds on, with the tag of "demo" unchanged`,
    async () => {
      const lines = [...DOCKERFILE];
      lines.splice(3, 0, "RUN echo more");
      Object.assign(profile, { dockerfile: lines.join("\n") });
      await putProfile(sut, profile);
    },
  );

  let run: Awaited<ReturnType<typeof runProfile>>;
  await when(`the developer runs "osf check PROFILE" against the base commit`, async () => {
    run = await runProfile(sut, { OSF_BASE: base });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout).toBe(1);
  });

  await then(
    `the output contains "PROFILE deploy/compose/compose.yaml:4 the stage demo of deploy/images/Dockerfile changed, so the tag 0.2.0 of the image demo must change too"`,
    async () => {
      expect(run.stdout).toContain(
        `PROFILE deploy/compose/compose.yaml:4 the stage demo of deploy/images/Dockerfile changed, so the tag 0.2.0 of the image demo must change too`,
      );
    },
  );
});
