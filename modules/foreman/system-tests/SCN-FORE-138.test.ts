import { scenario } from "@opensoftware/testkit";
import { API_TOKEN, readmeFiles } from "./foreman.ts";

const PROBLEM = "factory.yaml: commit the changed files inference/litellm.yaml; a run's factory version is its commit";

scenario("SCN-FORE-138", async ({ sut, fakes, given, when, then }) => {
  const files = readmeFiles(fakes);
  await given(
    'the README\'s "gateway/factory.yaml" is committed in the folder "hello" of the factory\'s repository without "inference/litellm.yaml"',
    async () => {
      await sut.files.put("$INPUT/hello/factory.yaml", files["gateway/factory.yaml"] as string);
      for (const name of ["agents/plan.md", "agents/implement.md"])
        await sut.files.put(`$INPUT/hello/${name}`, files[name] as string);
      await sut.git.commit("the hello factory without its inference config");
    },
  );

  await given('"hello/inference/litellm.yaml" is written but not added', async () => {
    await sut.files.put("$INPUT/hello/inference/litellm.yaml", files["inference/litellm.yaml"] as string);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "foreman serve" with "FOREMAN_FACTORY" set to "hello/factory.yaml"', async () => {
    run = await sut.cli(["serve"], { env: { FOREMAN_API_TOKEN: API_TOKEN, FOREMAN_FACTORY: "hello/factory.yaml" } });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stderr).toBe(2);
  });

  await then(
    'the output contains "factory.yaml: commit the changed files inference/litellm.yaml; a run\'s factory version is its commit"',
    async () => {
      expect(run.stderr).toContain(PROBLEM);
    },
  );
});
