import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

const SIGN_IN =
  'const base = process.env.DEMO_GITHUB_URL;\nconst redirect = "http://127.0.0.1:9/callback";\nconst authorize = new URL(`${base}/login/oauth/authorize`);\nfor (const [key, value] of Object.entries({ client_id: process.env.DEMO_CLIENT_ID, redirect_uri: redirect, state: "state-1", scope: "read:user user:email" }))\n  authorize.searchParams.set(key, value);\nconst back = new URL((await fetch(authorize, { redirect: "manual" })).headers.get("location"));\nconst answer = await (await fetch(`${base}/login/oauth/access_token`, {\n  method: "POST",\n  headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },\n  body: new URLSearchParams({ client_id: process.env.DEMO_CLIENT_ID, client_secret: process.env.DEMO_CLIENT_SECRET, code: back.searchParams.get("code"), redirect_uri: redirect }),\n})).json();\nconst headers = { authorization: `Bearer ${answer.access_token}` };\nconst user = await (await fetch(`${base}/user`, { headers })).json();\nconst emails = await (await fetch(`${base}/user/emails`, { headers })).json();\nconst primary = emails.find((each) => each.primary);\nprocess.stdout.write(JSON.stringify({ state: back.searchParams.get("state"), login: user.login, name: user.name, email: primary.email, verified: primary.verified }));\n';

scenario("SCN-TK-163", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI signs in at GitHub in "DEMO_GITHUB_URL" with its OAuth app, and prints the state, the login, the name and the primary email with its verification',
    async () => {
      module = demoModule({
        bin: SIGN_IN,
        readme: [
          "# demo",
          "",
          "## Configuration",
          "",
          "| Variable | Meaning |",
          "| --- | --- |",
          "| `DEMO_GITHUB_URL` | GitHub. |",
          "| `DEMO_CLIENT_ID` | The OAuth app. |",
          "| `DEMO_CLIENT_SECRET` | Its secret. |",
          "",
        ].join("\n"),
        steps: ["When the user signs in with GitHub", "Then GitHub gives the person"],
        test: [
          "const github = await fakes.github();",
          'github.signIn({ login: "ada", email: "ada@acme.dev", name: "Ada" });',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user signs in with GitHub', async () => {",
          "  run = await sut.cli([], { env: { DEMO_GITHUB_URL: github.url, DEMO_CLIENT_ID: github.oauth.clientId, DEMO_CLIENT_SECRET: github.oauth.clientSecret } });",
          "});",
          "await then('GitHub gives the person', async () => {",
          "  expect(run.exitCode, run.stderr).toBe(0);",
          '  expect(JSON.parse(run.stdout)).toEqual({ state: "state-1", login: "ada", name: "Ada", email: "ada@acme.dev", verified: true });',
          "});",
        ],
      });
    },
  );

  await given(
    'its system test signs in "ada" with the email "ada@acme.dev" named "Ada" at fakes.github and expects them, the email as verified',
    async () => {
      for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"report.xml" has the passed test case "SCN-DEMO-001"', async () => {
    expect(testCases(await sut.files.read("$INPUT/report.xml"))).toContainEqual({
      name: "SCN-DEMO-001",
      failed: false,
    });
  });
});
