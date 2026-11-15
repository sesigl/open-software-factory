import { scenario } from "@opensoftware/testkit";
import { operatorFactory, profile, words } from "./profile.ts";

// The OAuth app of the operator, made up for the test: no GitHub issued it.
const CLIENT_ID = "Iv1.acme0console";
const CLIENT_SECRET = "github-oauth-secret-1";
// The console's address names its port before it starts, so the port cannot be 0. Below Linux's ephemeral range, so
// no outgoing connection or port of another scenario takes it; no other scenario of the suite uses it.
const PORT = "18080";

/**
 * A browser without script: it keeps the console's cookies and follows no redirect, so each step sees one answer.
 * sut.pages reads only pages of a server that sut.http started, and the profile's console runs in a container.
 */
function browser(base: string) {
  const jar = new Map<string, string>();
  return async (path: string) => {
    const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
    const response = await fetch(new URL(path, base), { redirect: "manual", headers: cookie ? { cookie } : {} });
    for (const line of response.headers.getSetCookie()) {
      const [name, value] = (line.split(";")[0] ?? "").split("=", 2) as [string, string];
      if (value) jar.set(name, value);
      else jar.delete(name);
    }
    return { status: response.status, location: response.headers.get("location") ?? "", html: await response.text() };
  };
}

scenario("SCN-DIST-037", async ({ sut, fakes, given, when, then }) => {
  let compose: Awaited<ReturnType<typeof profile>>;
  await given(
    'the Compose profile with every value of ".env.example" set in ".env", "CONSOLE_SIGN_IN" set to "github" with the client of a GitHub OAuth app, and "CONSOLE_PORT" set to "18080"',
    async () => {
      compose = await profile(sut, undefined, {
        CONSOLE_SIGN_IN: "github",
        CONSOLE_GITHUB_CLIENT_ID: CLIENT_ID,
        CONSOLE_GITHUB_CLIENT_SECRET: CLIENT_SECRET,
        CONSOLE_SESSION_SECRET: "console-session-secret-1",
        CONSOLE_PORT: PORT,
        // FACTORY_DIR is a value of ".env.example": the operator's copy lists a real admin (ADR 0134).
        FACTORY_DIR: await operatorFactory(sut, fakes),
      });
    },
  );

  await given(
    'the operator\'s factory, whose "access.yaml" lists "ada@acme.dev" as "admin" in place of "admin@example.com"',
    async () => {
      const access = await sut.files.read("$INPUT/factory/access.yaml");
      expect(access).toContain("- email: ada@acme.dev\n    role: admin\n");
      expect(access).not.toContain("admin@example.com");
    },
  );

  // GitHub's token exchange and API, as the console calls them from its container; the person consents in the browser.
  const github = await fakes.http(
    [
      { method: "POST", path: "/login/oauth/access_token", body: { access_token: "gho_ada" }, times: 1 },
      { method: "POST", path: "/login/oauth/access_token", body: { access_token: "gho_mallory" } },
      { path: "/user", body: { login: "ada", name: "Ada" }, times: 1 },
      { path: "/user", body: { login: "mallory", name: "Mallory" } },
      { path: "/user/emails", body: [{ email: "ada@acme.dev", primary: true, verified: true }], times: 1 },
      { path: "/user/emails", body: [{ email: "mallory@acme.dev", primary: true, verified: true }] },
    ],
    { containers: true },
  );
  const override = "$INPUT/github.yaml";
  await given('GitHub is a fake on the Docker host, which the console reaches as "host.docker.internal"', async () => {
    await sut.files.put(
      override,
      [
        "services:",
        "  console:",
        // Docker Desktop knows the name; Linux needs it mapped to the host.
        '    extra_hosts: ["host.docker.internal:host-gateway"]',
        "    environment:",
        `      CONSOLE_GITHUB_URL: ${github.containerUrl}`,
        `      CONSOLE_GITHUB_API_URL: ${github.containerUrl}`,
        "",
      ].join("\n"),
    );
    expect(github.containerUrl).toMatch(/^http:\/\/host\.docker\.internal:\d+$/);
  });

  await given(
    'the operator ran "docker compose run --rm factory-repo", which commits the factory into its volume',
    async () => {
      const run = await compose.run(words("docker compose run --rm factory-repo"));
      expect(run.exitCode, run.stderr).toBe(0);
    },
  );

  // Only the console: the sign-in needs no other service, and the profile's console waits for none with --no-deps.
  await when('the operator runs "docker compose up --detach --wait --no-deps console"', async () => {
    const command = words("docker compose up --detach --wait --no-deps console");
    const up = await compose.run(["--file", sut.files.path(override), ...command]);
    expect(up.exitCode, up.stderr).toBe(0);
  });

  await then('the service "console" is running and healthy', async () => {
    const console = (await compose.services()).find((service) => service.service === "console");
    expect({ state: console?.state, health: console?.health }).toEqual({ state: "running", health: "healthy" });
  });

  let open: ReturnType<typeof browser>;
  await then(
    'the console\'s page "/" sends a person without a session to the sign-in page with the button "Sign in with GitHub"',
    async () => {
      // The person opens the console on localhost, CONSOLE_URL's host, where the profile publishes its port.
      open = browser((await compose.url("console", 8080)).replace("127.0.0.1", "localhost"));
      const runs = await open("/");
      expect({ status: runs.status, location: runs.location }).toEqual({ status: 303, location: "/signin?next=%2F" });
      const signIn = await open(runs.location);
      expect(signIn.status).toBe(200);
      expect(signIn.html).toContain("Sign in with GitHub");
    },
  );

  /** Presses the sign-in button and gives where the console sends the person: GitHub's authorization. */
  const start = async () => {
    const answer = await open("/signin/start?next=%2F");
    expect(answer.status).toBe(303);
    return new URL(answer.location);
  };
  /** GitHub's answer after the person consents: back to the callback with a code and the sign-in's state. */
  const back = (authorize: URL, code: string) => {
    const callback = new URL(authorize.searchParams.get("redirect_uri") ?? "");
    callback.searchParams.set("code", code);
    callback.searchParams.set("state", authorize.searchParams.get("state") ?? "");
    return open(callback.pathname + callback.search);
  };

  await then(
    'the button sends the person to GitHub with the callback "http://localhost:18080/signin/callback"',
    async () => {
      const authorize = await start();
      expect(authorize.origin + authorize.pathname).toBe(`${github.containerUrl}/login/oauth/authorize`);
      expect(authorize.searchParams.get("client_id")).toBe(CLIENT_ID);
      expect(authorize.searchParams.get("redirect_uri")).toBe(`http://localhost:${PORT}/signin/callback`);
    },
  );

  await then(
    '"ada@acme.dev" comes back from GitHub, the console trades the code with the client of ".env", and the page "/" has the heading "Runs" and the account "ada@acme.dev · admin"',
    async () => {
      const signedIn = await back(await start(), "github-code-ada");
      expect({ status: signedIn.status, location: signedIn.location }).toEqual({ status: 303, location: "/" });
      const trade = github.received().find((request) => request.path === "/login/oauth/access_token");
      const fields = new URLSearchParams(String(trade?.body));
      expect(
        Object.fromEntries(["client_id", "client_secret", "code"].map((name) => [name, fields.get(name)])),
      ).toEqual({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: "github-code-ada",
      });
      const runs = await open("/");
      expect(runs.status).toBe(200);
      expect(runs.html).toContain("<h1>Runs</h1>");
      expect(runs.html).toContain("ada@acme.dev · admin");
    },
  );

  await then(
    '"mallory@acme.dev" comes back from GitHub and reads "mallory@acme.dev is not on this factory\'s access list"',
    async () => {
      const refused = await back(await start(), "github-code-mallory");
      expect(refused.status).toBe(403);
      // The page as the console sends it: the apostrophe escaped, as in every text the console writes into HTML.
      expect(refused.html).toContain("mallory@acme.dev is not on this factory&#39;s access list");
    },
  );
});
