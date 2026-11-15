import type { RunView } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { api, FOREMAN_TOKEN, factoryYaml, type Smoke, smoke, started, WORK } from "./profile.ts";

// The console's address names its port before it starts, so the port cannot be 0. Below Linux's ephemeral range; no
// other scenario of the suite uses it.
const PORT = "18081";
const CONSOLE = `http://localhost:${PORT}`;
// Made up for the test: no store outside the scenario's own ever held it.
const VALUE = "lin_made_up_value_e2e_5b9d";
const REASON = 'the secret "ref:openbao/linear-token" has no value; store it and run again';
/** The second work item: the same request again, as a person posts it after the value is stored. */
const AGAIN = { ...WORK, id: "wi_6e2d2a1b0f8c4d3e5f70", dedupeKey: "idea:export-csv-again" };

/**
 * A browser without script: it keeps the console's cookies and follows no redirect, so each step sees one answer.
 * A form names the console's own address in Origin, as a browser does (ADR 0134).
 */
function browser(base: string) {
  const jar = new Map<string, string>();
  return async (path: string, form?: Record<string, string>) => {
    const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
    const response = await fetch(new URL(path, base), {
      method: form ? "POST" : "GET",
      redirect: "manual",
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(form ? { origin: CONSOLE, "content-type": "application/x-www-form-urlencoded" } : {}),
      },
      body: form ? new URLSearchParams(form).toString() : undefined,
    });
    for (const line of response.headers.getSetCookie()) {
      const [name, value] = (line.split(";")[0] ?? "").split("=", 2) as [string, string];
      if (value) jar.set(name, value);
      else jar.delete(name);
    }
    return { status: response.status, location: response.headers.get("location") ?? "", html: await response.text() };
  };
}

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

  // GitHub's token exchange and API, as the console calls them from its container; the person consents in the browser.
  const github = await fakes.http(
    [
      { method: "POST", path: "/login/oauth/access_token", body: { access_token: "gho_grace" } },
      { path: "/user", body: { login: "grace", name: "Grace" } },
      { path: "/user/emails", body: [{ email: "grace@acme.dev", primary: true, verified: true }] },
    ],
    { containers: true },
  );

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
        {
          CONSOLE_PORT: PORT,
          CONSOLE_SIGN_IN: "github",
          // The OAuth app of the operator, made up for the test: no GitHub issued it.
          CONSOLE_GITHUB_CLIENT_ID: "Iv1.acme0console",
          CONSOLE_GITHUB_CLIENT_SECRET: "github-oauth-secret-1",
          CONSOLE_SESSION_SECRET: "console-session-secret-1",
          E2E_GITHUB_URL: github.containerUrl as string,
        },
        { sandboxes: true },
      );
    },
  );

  let open: ReturnType<typeof browser>;
  await given(
    'the console with the sign-in of GitHub, where "grace@acme.dev" of the factory\'s "access.yaml" signed in as "factory-engineer"',
    async () => {
      // The access file needs an admin; the person who signs in is the factory engineer.
      const people = [
        "  - email: ada@acme.dev",
        "    role: admin",
        "  - email: grace@acme.dev",
        "    role: factory-engineer",
      ];
      const access = ["version: 1", "people:", ...people, ""].join("\n");
      await sut.files.put("$INPUT/factory/access.yaml", access);
      await started(profile, ["foreman", "console"]);
      // The person opens the console on localhost, CONSOLE_URL's host, where the profile publishes its port.
      open = browser((await profile.compose.url("console", 8080)).replace("127.0.0.1", "localhost"));
      const authorize = new URL((await open("/signin/start?next=%2Fsecrets")).location);
      // GitHub's answer after the person consents: back to the callback with a code and the sign-in's state.
      const callback = new URL(authorize.searchParams.get("redirect_uri") ?? "");
      callback.searchParams.set("code", "github-code-grace");
      callback.searchParams.set("state", authorize.searchParams.get("state") ?? "");
      const signedIn = await open(callback.pathname + callback.search);
      expect({ status: signedIn.status, location: signedIn.location }).toEqual({ status: 303, location: "/secrets" });
      expect((await open("/secrets")).html).toContain("grace@acme.dev · factory-engineer");
    },
  );

  let foreman = "";
  const post = async (work: typeof WORK): Promise<string> => {
    const answer = await api(foreman, FOREMAN_TOKEN, "/v1/runs", { method: "POST", body: work });
    expect(answer.status, JSON.stringify(answer.body)).toBe(201);
    return (answer.body as RunView).runId;
  };
  const implement = async (runId: string) =>
    ((await api(foreman, FOREMAN_TOKEN, `/v1/runs/${runId}`)).body as RunView).stages.find(
      (candidate) => candidate.stage === "implement",
    );

  await given(
    'a first run, whose stage "implement" failed for the reason \'the secret "ref:openbao/linear-token" has no value; store it and run again\'',
    async () => {
      foreman = await profile.url("foreman");
      const first = await post(WORK);
      await profile.until(async () => (await implement(first))?.state, "failed");
      expect((await implement(first))?.reason).toBe(REASON);
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
      second = await post(AGAIN);
    },
  );

  await then('the stage "implement" of the second run succeeded', async () => {
    await profile.until(async () => (await implement(second))?.state, "succeeded");
    const view = await api(await profile.url("foreman"), FOREMAN_TOKEN, `/v1/runs/${second}`);
    expect((view.body as RunView).stages.map(({ stage, state }) => ({ stage, state }))).toEqual([
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
