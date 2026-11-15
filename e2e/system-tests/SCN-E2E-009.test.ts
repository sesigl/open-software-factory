import { type Forge, scenario } from "@opensoftware/testkit";
import {
  type Answer,
  type Browser,
  factoryRepository,
  factoryYaml,
  githubSignIn,
  implementOf,
  merged,
  type PullOfForge,
  passCheck,
  postRun,
  runView,
  type Smoke,
  smoke,
  started,
  WORK,
} from "./profile.ts";

// Below Linux's ephemeral range; no other scenario of the suite uses it.
const PORT = "18083";
// Made up for the test: no store outside the scenario's own ever held it.
const VALUE = "lin_made_up_value_e2e_9c41";
const SKILL = [
  "---",
  "name: linear-notes",
  "description: Write the notes of a change from its Linear issues. Use when a change ships.",
  "metadata:",
  "  opensoftware/secrets: LINEAR_TOKEN",
  "  opensoftware/hosts: host.docker.internal",
  "---",
  "",
  "# Linear notes",
  "",
  "Read the Linear issues of the change with LINEAR_TOKEN, then write its notes.",
  "",
].join("\n");
const EDITS = [
  "The factory declares the secrets provider openbao at ^0.",
  "The agent implement gets the secret reference ref:openbao/linear-token.",
  "The agent implement gets the skill ./skills/linear-notes.",
];

/** The texts of the items of the list "What the change does" of the page that asks first. */
const editsOf = (page: Answer): string[] => {
  const list = /<ul[^>]*aria-label="What the change does"[^>]*>([\s\S]*?)<\/ul>/.exec(page.html)?.[1] ?? "";
  return [...list.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(([, item]) =>
    (item ?? "")
      .replace(/<[^>]+>/g, "")
      .replaceAll("&amp;", "&")
      .trim(),
  );
};

/** The value of the hidden field of the form "Propose change", as the browser sends it. */
const hiddenOf = (page: Answer, name: string): string =>
  (new RegExp(`name="${name}" value="([^"]*)"`).exec(page.html)?.[1] ?? "")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");

scenario("SCN-E2E-009", async ({ sut, fakes, given, when, then }) => {
  // The API that the skill reaches, on the Docker host.
  const linear = await fakes.http([{ path: "/viewer", body: { login: "ada" } }], { containers: true });

  let forge: Forge;
  let factory = "";
  let repository: Record<string, string> = {};
  await given(
    'a factory repository on Forgejo that declares the secrets provider "env", whose agent "notes" uses the skill "linear-notes", which needs the secret "LINEAR_TOKEN" and the host "host.docker.internal", whose agent "implement" runs in a sandbox of the workspace image that reaches "host.docker.internal" and has no secret and no skill, and whose main branch requires the check "factory"',
    async () => {
      forge = await fakes.forge();
      factory = factoryYaml(["implement"], {
        providers: ["secrets:", '  env: "^0"'],
        agent: ["sandbox:", "  template: osf-e2e:workspace", "  egress: [host.docker.internal]"],
        // An agent of no stage that already uses the skill, so the catalog has it.
        agents: [
          "notes:",
          "  harness: acp",
          "  model: routes/notes",
          "  effort: medium",
          "  prompt: ./agents/triage.md",
          "  secrets: [ref:env/LINEAR_TOKEN]",
          "  skills: [./skills/linear-notes]",
        ],
      });
      repository = await factoryRepository(fakes, forge, factory, { "skills/linear-notes/SKILL.md": SKILL });
    },
  );

  const github = await githubSignIn(fakes, PORT);
  let profile: Smoke;
  await given(
    'the Compose profile with that repository in "FACTORY_REPOSITORY", and the scripted harness that prints the skill\'s "SKILL.md" and asks the API at "host.docker.internal" with "Authorization: Bearer $LINEAR_TOKEN" when asked to implement',
    async () => {
      const turns = [
        {
          when: "Implement the work item",
          commands: [
            "cat .claude/skills/linear-notes/SKILL.md",
            `curl -sS -H "Authorization: Bearer $LINEAR_TOKEN" ${linear.containerUrl}/viewer`,
          ],
        },
      ];
      profile = await smoke(
        sut,
        fakes,
        factory,
        turns,
        undefined,
        { ...repository, ...github.env },
        { sandboxes: true },
      );
    },
  );

  let open: Browser;
  await given(
    'the console with the sign-in of GitHub, where "grace@acme.dev" of the repository\'s "access.yaml" signed in as "factory-engineer"',
    async () => {
      await started(profile, ["foreman", "console"]);
      open = await github.signIn(profile, "/skills/linear-notes");
    },
  );

  let asked: Answer;
  let sent: Answer;
  await when(
    'the factory engineer opens "/skills/linear-notes", presses "Switch on for implement" and then "Propose change"',
    async () => {
      const skill = await open("/skills/linear-notes");
      expect(skill.html, skill.html).toMatch(/Switch on<span[^>]*> for implement<\/span>/);
      // The switch is a form that opens the page that asks first with the agent.
      asked = await open("/skills/linear-notes/switch?agent=implement");
      sent = await open("/changes", { edits: hiddenOf(asked, "edits") });
    },
  );

  await then(
    'the page that asked first listed "The factory declares the secrets provider openbao at ^0.", "The agent implement gets the secret reference ref:openbao/linear-token." and "The agent implement gets the skill ./skills/linear-notes."',
    async () => {
      expect(asked.status, asked.html).toBe(200);
      expect(editsOf(asked)).toEqual(EDITS);
    },
  );

  await then('the console answered 303 to "/changes"', async () => {
    expect({ status: sent.status, location: sent.location }, sent.html).toEqual({ status: 303, location: "/changes" });
  });

  let pull: PullOfForge;
  await when(
    "the check \"factory\" of the pull request's head passes, posted as the factory's workflow posts it, and the forge merges it",
    async () => {
      await passCheck(forge);
      pull = await merged(forge);
      expect(pull.merged).toBe(true);
    },
  );

  let run = "";
  await when(
    'the factory engineer stores a value for "linear-token" in the form of the page "/secrets", and a program posts the work item to foreman\'s "/v1/runs"',
    async () => {
      const stored = await open("/secrets", { name: "linear-token", value: VALUE });
      expect({ status: stored.status, location: stored.location }, stored.html).toEqual({
        status: 303,
        location: "/secrets",
      });
      run = await postRun(await profile.url("foreman"), WORK);
    },
  );

  await then('the stage "implement" of the run succeeded with the merge commit as its factory version', async () => {
    const foreman = await profile.url("foreman");
    await profile.until(async () => (await implementOf(foreman, run))?.state, "succeeded");
    const view = await runView(foreman, run);
    expect({ version: view.factoryVersion, stages: view.stages.map(({ stage, state }) => ({ stage, state })) }).toEqual(
      {
        version: pull.merge_commit_sha,
        stages: [{ stage: "implement", state: "succeeded" }],
      },
    );
  });

  await then(
    'the agent found the "SKILL.md" of the repository in ".claude/skills/linear-notes" of its folder',
    async () => {
      const printed = profile.harness.commands().find((command) => command.command.startsWith("cat "));
      expect({ exitCode: printed?.exitCode, output: printed?.output }).toEqual({
        exitCode: 0,
        output: await forge.file("factory", "skills/linear-notes/SKILL.md", "main"),
      });
    },
  );

  await then('the API got one request, with "Authorization: Bearer" and the stored value', async () => {
    expect(linear.headers()).toMatchObject([
      { method: "GET", path: "/viewer", headers: { authorization: `Bearer ${VALUE}` } },
    ]);
  });
});
