import { scenario } from "@opensoftware/testkit";
import {
  ACCESS,
  type Browser,
  factoryYaml,
  githubSignIn,
  implementOf,
  postRun,
  runView,
  type Smoke,
  smoke,
  started,
  WORK,
} from "./profile.ts";

// Below Linux's ephemeral range; no other scenario of the suite uses it.
const PORT = "18081";
// Made up for the test: no store outside the scenario's own ever held it.
const VALUE = "lin_made_up_value_e2e_5b9d";
const REASON = 'the secret "ref:openbao/linear-token" has no value; store it and run again';
/** The second work item: the same request again, as a person posts it after the value is stored. */
const AGAIN = { ...WORK, id: "wi_6e2d2a1b0f8c4d3e5f70", dedupeKey: "idea:export-csv-again" };

scenario("SCN-E2E-007", async ({ sut, fakes, given, when, then }) => {
  // The API that the agent may reach, on the Docker host.
  const linear = await fakes.http([{ path: "/viewer", body: { login: "ada" } }], { containers: true });

  let factory = "";
  await given(
    'a factory whose agent "implement" runs in a sandbox of the workspace image with the egress allowlist "host.docker.internal" and the secret "ref:openbao/linear-token"',
    async () => {
      factory = factoryYaml(["implement"], {
        providers: ["secrets:", '  openbao: "^0"'],
        agent: [
          "secrets: [ref:openbao/linear-token]",
          "sandbox:",
          "  template: osf-e2e:workspace",
          "  egress: [host.docker.internal]",
        ],
      });
    },
  );

  const github = await githubSignIn(fakes, PORT);
  let profile: Smoke;
  await given(
    'the scripted harness prints its environment and asks the API at "host.docker.internal" with "Authorization: Bearer $LINEAR_TOKEN" when asked to implement',
    async () => {
      profile = await smoke(
        sut,
        fakes,
        factory,
        [
          {
            when: "Implement the work item",
            commands: ["env", `curl -sS -H "Authorization: Bearer $LINEAR_TOKEN" ${linear.containerUrl}/viewer`],
          },
        ],
        undefined,
        github.env,
        { sandboxes: true },
      );
    },
  );

  let open: Browser;
  await given(
    'the console with the sign-in of GitHub, where "grace@acme.dev" of the factory\'s "access.yaml" signed in as "factory-engineer"',
    async () => {
      // The access file needs an admin; the person who signs in is the factory engineer.
      await sut.files.put("$INPUT/factory/access.yaml", ACCESS);
      await started(profile, ["foreman", "console"]);
      open = await github.signIn(profile, "/secrets");
      expect((await open("/secrets")).html).toContain("grace@acme.dev · factory-engineer");
    },
  );

  let foreman = "";
  await given(
    'a first run, whose stage "implement" failed for the reason \'the secret "ref:openbao/linear-token" has no value; store it and run again\'',
    async () => {
      foreman = await profile.url("foreman");
      const first = await postRun(foreman, WORK);
      await profile.until(async () => (await implementOf(foreman, first))?.state, "failed");
      expect((await implementOf(foreman, first))?.reason).toBe(REASON);
      // The stage failed before its first turn: the agent asked nothing.
      expect(linear.headers()).toEqual([]);
    },
  );

  let second = "";
  await when(
    'the factory engineer stores a value for "linear-token" in the form of the page "/secrets", and a program posts a second work item to foreman\'s "/v1/runs"',
    async () => {
      const stored = await open("/secrets", { name: "linear-token", value: VALUE });
      expect({ status: stored.status, location: stored.location }, stored.html).toEqual({
        status: 303,
        location: "/secrets",
      });
      second = await postRun(foreman, AGAIN);
    },
  );

  await then('the stage "implement" of the second run succeeded', async () => {
    await profile.until(async () => (await implementOf(foreman, second))?.state, "succeeded");
    const view = await runView(await profile.url("foreman"), second);
    expect(view.stages.map(({ stage, state }) => ({ stage, state }))).toEqual([
      { stage: "implement", state: "succeeded" },
    ]);
  });

  await then('the API got one request, with "Authorization: Bearer" and the stored value', async () => {
    expect(linear.headers()).toMatchObject([
      { method: "GET", path: "/viewer", headers: { authorization: `Bearer ${VALUE}` } },
    ]);
  });

  await then(
    'the agent\'s environment holds "LINEAR_TOKEN" as "osf-secret-placeholder-LINEAR_TOKEN" and not the value',
    async () => {
      const environment = profile.harness.commands().find((command) => command.command === "env")?.output ?? "";
      expect(environment.split("\n")).toContain("LINEAR_TOKEN=osf-secret-placeholder-LINEAR_TOKEN");
      expect(environment).not.toContain(VALUE);
    },
  );

  await then(
    'the page "/secrets" names "linear-token" as "Set" by "grace@acme.dev" and does not hold the value',
    async () => {
      const page = await open("/secrets");
      expect(page.status).toBe(200);
      expect(page.html).toMatch(
        /linear-token<\/span>\s*<span[^>]*>Used by the agent implement · version 1, set by grace@acme\.dev on /,
      );
      expect(page.html).toMatch(/>Set<\/span>/);
      expect(page.html).not.toContain(VALUE);
    },
  );

  await then("the logs of the console and the foreman do not hold the value", async () => {
    const logs = await profile.compose.run(["logs", "--no-color", "console", "foreman"]);
    expect(logs.exitCode, logs.stderr).toBe(0);
    expect(logs.stdout).toContain("console");
    expect(logs.stdout + logs.stderr).not.toContain(VALUE);
  });
});
