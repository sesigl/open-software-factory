import type { CatalogSkill } from "@opensoftware/contracts";
import { type Page, scenario } from "@opensoftware/testkit";
import { ENGINEER, unreachableEnv } from "./changes.ts";
import type { AgentOf } from "./secrets.ts";
import { skillOf } from "./skills.ts";
import { editTexts, servingSwitches } from "./switches.ts";

const REPOSITORY = "https://github.com/acme/skills.git";
const ENTRY = `git+${REPOSITORY}#v1.2:skills/release-notes`;
const COMMIT = "7c2e91d4f0b3a8c6e5d2f1a0b9c8d7e6f5a4b3c2";

const effect = (agent: string) =>
  `The console opens a pull request with these edits on the factory's repository. The forge merges it when its check factory passes, and ${agent} has the skill from its next run.`;

scenario("SCN-CONSOLE-239", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given(
    'a console with a factory repository at "http://127.0.0.1:9/tester/factory.git" that does not answer, and "grace@acme.dev" as "factory-engineer"',
    async () => {
      env = unreachableEnv(sut);
    },
  );

  let skill: CatalogSkill;
  let agents: Record<string, AgentOf> = {};
  await given(
    'the skill "release-notes" of "git+https://github.com/acme/skills.git#v1.2:skills/release-notes", used by "triage", which needs "LINEAR_TOKEN" and the host "api.linear.app"',
    async () => {
      skill = skillOf(
        "release-notes",
        { triage: { secrets: { LINEAR_TOKEN: "ref:env/LINEAR_TOKEN" } } },
        {
          source: { folder: "skills/release-notes", repository: REPOSITORY, commit: COMMIT },
          needs: { secrets: ["LINEAR_TOKEN"], hosts: ["api.linear.app"] },
        },
      );
      agents = { triage: { skills: [ENTRY], secrets: ["ref:env/LINEAR_TOKEN"], egress: ["api.linear.app"] } };
    },
  );

  await given(
    'the agent "review", whose sandbox reaches "api.linear.app" and which declares "ref:env/LINEAR_TOKEN", and the agent "spec" without a sandbox, which declares "ref:env/linear-token"',
    async () => {
      const review = { secrets: ["ref:env/LINEAR_TOKEN"], egress: ["api.github.com", "api.linear.app"] };
      await servingSwitches(sut, fakes, env, { ...agents, review, spec: { secrets: ["ref:env/linear-token"] } }, [
        skill,
      ]);
    },
  );

  let review: Page;
  let spec: Page;
  let sent: Page;
  await when(
    '"grace@acme.dev" opens the pages that ask first for "review" and for "spec", and presses "Propose change" on the first',
    async () => {
      const ask = (agent: string) =>
        sut.pages.open(`/skills/release-notes/switch?agent=${agent}`, { headers: ENGINEER });
      [review, spec] = await Promise.all([ask("review"), ask("spec")]);
      sent = await review.submit("Propose change", {}, { follow: false });
    },
  );

  await then(
    'each lists only "The agent <agent> gets the skill git+https://github.com/acme/skills.git#v1.2:skills/release-notes."',
    async () => {
      expect([editTexts(review), editTexts(spec)]).toEqual([
        [`The agent review gets the skill ${ENTRY}.`],
        [`The agent spec gets the skill ${ENTRY}.`],
      ]);
    },
  );

  await then(
    'each says "The console opens a pull request with these edits on the factory\'s repository. The forge merges it when its check factory passes, and <agent> has the skill from its next run."',
    async () => {
      expect(review.getByText(/^The console opens a pull request/).text).toBe(effect("review"));
      expect(spec.getByText(/^The console opens a pull request/).text).toBe(effect("spec"));
    },
  );

  await then(
    'the form answered 502 and said "Not proposed: cannot fetch main of http://127.0.0.1:9/tester/factory.git": its edit passed the checks of a form',
    async () => {
      expect(sent.status).toBe(502);
      expect(sent.text).toContain("Not proposed: cannot fetch main of http://127.0.0.1:9/tester/factory.git");
    },
  );
});
