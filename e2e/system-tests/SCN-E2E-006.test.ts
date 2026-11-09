import type { RunView } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import {
  api,
  FOREMAN_TOKEN,
  factoryYaml,
  fromContainer,
  GATEKEEPER_TOKEN,
  INTAKE_TOKEN,
  LITELLM_KEY,
  type Smoke,
  smoke,
  started,
  WORK,
} from "./profile.ts";

const BRANCH = "sandboxed";

scenario("SCN-E2E-006", async ({ sut, fakes, given, when, then }) => {
  const forge = await fakes.forge();
  const server = fromContainer(forge.url);
  // As git sends a token: the user x-access-token with the token as its password (ADR 0096).
  const remote = `${server.replace("//", "//x-access-token:$FORGE_TOKEN@")}/${forge.owner}/web.git`;

  let factory = "";
  await given(
    'a factory whose agent "implement" runs in a sandbox of the workspace image with the egress allowlist "host.docker.internal" and the secret "ref:env/FORGE_TOKEN"',
    async () => {
      await forge.createRepository("web");
      factory = factoryYaml(["implement"], {
        agent: [
          "secrets: [ref:env/FORGE_TOKEN]",
          "sandbox:",
          "  template: osf-e2e:workspace",
          "  egress: [host.docker.internal]",
        ],
      });
    },
  );

  let profile: Smoke;
  await given(
    'the scripted harness prints its environment and pushes the branch "sandboxed" with "$FORGE_TOKEN" as its password when asked to implement',
    async () => {
      profile = await smoke(
        sut,
        fakes,
        factory,
        [
          {
            when: "Implement the work item",
            commands: [
              "env",
              `git clone -q "${remote}" web`,
              `cd web && git checkout -q -b ${BRANCH} && echo sandboxed > SANDBOXED.md && git add SANDBOXED.md`,
              `cd web && git -c user.name=agent -c user.email=agent@example.invalid commit -qm sandboxed && git push -q origin ${BRANCH}`,
            ],
          },
        ],
        forge,
        {},
        { sandboxes: true },
      );
      await started(profile, ["foreman"]);
    },
  );

  let foreman = "";
  let runId = "";
  await when('a program posts the work item to foreman\'s "/v1/runs" with the API token', async () => {
    foreman = await profile.url("foreman");
    const answer = await api(foreman, FOREMAN_TOKEN, "/v1/runs", { method: "POST", body: WORK });
    expect(answer.status, JSON.stringify(answer.body)).toBe(201);
    runId = (answer.body as RunView).runId;
  });

  await then('the stage "implement" succeeded, and Forgejo has the branch "sandboxed"', async () => {
    const stage = async () =>
      ((await api(foreman, FOREMAN_TOKEN, `/v1/runs/${runId}`)).body as RunView).stages.find(
        (candidate) => candidate.stage === "implement",
      )?.state;
    await profile.until(stage, "succeeded");
    expect((await forge.branches("web")).map((branch) => branch.name)).toContain(BRANCH);
  });

  const environment = () => profile.harness.commands().find((command) => command.command === "env")?.output ?? "";
  await then('the agent\'s environment holds "FORGE_TOKEN" as "osf-secret-placeholder-FORGE_TOKEN"', async () => {
    expect(environment().split("\n")).toContain("FORGE_TOKEN=osf-secret-placeholder-FORGE_TOKEN");
  });

  await then(
    "it holds none of the forge token, the master key of litellm and the API tokens of foreman, intake and gatekeeper",
    async () => {
      const tokens = [forge.token, LITELLM_KEY, FOREMAN_TOKEN, INTAKE_TOKEN, GATEKEEPER_TOKEN];
      expect(tokens.filter((token) => environment().includes(token))).toEqual([]);
    },
  );
});
