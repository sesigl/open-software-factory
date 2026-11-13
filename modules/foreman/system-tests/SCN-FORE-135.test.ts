import { scenario } from "@opensoftware/testkit";
import { API_TOKEN, readmeFiles } from "./foreman.ts";

const PROBLEM =
  "factory.yaml: commit the changed files agents/plan.md, factory.yaml; a run's factory version is its commit";

scenario("SCN-FORE-135", async ({ sut, fakes, given, when, then }) => {
  const files = readmeFiles(fakes);
  await given(
    'the README\'s "factory.yaml" is committed in the factory\'s repository without "agents/plan.md"',
    async () => {
      for (const name of ["factory.yaml", "agents/implement.md"])
        await sut.files.put(`$INPUT/${name}`, files[name] as string);
      await sut.git.commit("the hello factory without its plan prompt");
    },
  );

  await given(
    '"agents/plan.md" is written but not added, "factory.yaml" has a change and "notes.md" is not tracked',
    async () => {
      await sut.files.put("$INPUT/agents/plan.md", files["agents/plan.md"] as string);
      await sut.files.put("$INPUT/factory.yaml", `${files["factory.yaml"]}# a change\n`);
      await sut.files.put("$INPUT/notes.md", "Notes the foreman does not read\n");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "foreman serve"', async () => {
    run = await sut.cli(["serve"], { env: { FOREMAN_API_TOKEN: API_TOKEN } });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stderr).toBe(2);
  });

  await then(
    'the output contains "factory.yaml: commit the changed files agents/plan.md, factory.yaml; a run\'s factory version is its commit"',
    async () => {
      expect(run.stderr).toContain(PROBLEM);
    },
  );
});
