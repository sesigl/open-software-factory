import { validate } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { agent, factoryYaml, prompt } from "./factory.ts";
import { committedReview, entryAt, REVIEW } from "./remote.ts";
import type { Catalog } from "./skills.ts";

const CHANGELOG = "git+https://forge.example/acme/skills.git#v1:skills/changelog";

scenario("SCN-FSPEC-128", async ({ sut, given, when, then }) => {
  let commit = "";
  await given(
    'the skill "review" is committed in "shared/review" on the branch "main" of a Git repository at a "file://" URL',
    async () => {
      commit = await committedReview(sut);
    },
  );

  const triage = () => agent("triage", [`skills: ["${entryAt(sut, "main")}"]`]);
  await given(
    'a factory.yaml whose agent "triage" has the skill "git+<url>#main:shared/review", which "factory plan" pinned',
    async () => {
      await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents: triage() }));
      await sut.files.put("$INPUT/agents/triage.md", prompt("triage"));
      const plan = await sut.cli(["plan"]);
      expect(plan.exitCode, plan.stdout + plan.stderr).toBe(0);
    },
  );

  await given(
    'whose agent "spec" has the skill "git+https://forge.example/acme/skills.git#v1:skills/changelog", which factory.lock does not pin',
    async () => {
      const spec = agent("spec", [`skills: ["${CHANGELOG}"]`]);
      await sut.files.put("$INPUT/factory.yaml", factoryYaml({ agents: [...triage(), ...spec] }));
      await sut.files.put("$INPUT/agents/spec.md", prompt("spec"));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory skills"', async () => {
    run = await sut.cli(["skills"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  const skill = (name: string) => (JSON.parse(run.stdout) as Catalog).skills.find((each) => each.name === name);
  await then(
    'the skill "review" has the source folder "shared/review", the repository "file://<path>" and the pinned commit, its description, its files and its body',
    async () => {
      const repository = `file://${sut.files.path("$INPUT")}`;
      expect(skill("review")).toEqual({
        name: "review",
        description: "The skill review. Use it in the scenarios of factory-spec.",
        source: { folder: "shared/review", repository, commit },
        needs: { secrets: [], hosts: [] },
        agents: [{ name: "triage", secrets: {}, lacks: { secrets: [], hosts: [] } }],
        files: ["SKILL.md"],
        body: REVIEW.slice(REVIEW.indexOf("\n---\n") + "\n---\n".length),
        problems: [],
      });
    },
  );

  await then(
    'the skill "changelog" has the source folder "skills/changelog" and the repository "https://forge.example/acme/skills.git" without a commit, no files, no body and the problem "factory.lock has no pin of the skill \\"changelog\\" for \\"git+https://forge.example/acme/skills.git#v1:skills/changelog\\": run \\"factory plan\\""',
    async () => {
      expect(skill("changelog")).toEqual(
        expect.objectContaining({
          source: { folder: "skills/changelog", repository: "https://forge.example/acme/skills.git" },
          description: null,
          files: [],
          body: null,
          problems: [`factory.lock has no pin of the skill "changelog" for "${CHANGELOG}": run "factory plan"`],
        }),
      );
    },
  );

  await then("the output is a valid skill catalog of the contracts", async () => {
    expect(validate("skill-catalog", JSON.parse(run.stdout))).toEqual([]);
  });
});
