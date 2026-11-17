import { type FakeGitHub, scenario } from "@opensoftware/testkit";

scenario("SCN-TK-163", async ({ fakes, given, when, then }) => {
  let github: FakeGitHub;
  await given('fakes.github, which signs in "ada" with the email "ada@acme.dev" named "Ada"', async () => {
    github = await fakes.github();
    github.signIn({ login: "ada", email: "ada@acme.dev", name: "Ada" });
  });

  let signedIn: Record<string, unknown> = {};
  await when(
    "a module signs in at fakes.github with its OAuth app and reads the state, the login, the name and the primary email with its verification",
    async () => {
      const redirect = "http://127.0.0.1:9/callback";
      const authorize = new URL(`${github.url}/login/oauth/authorize`);
      const query = {
        client_id: github.oauth.clientId,
        redirect_uri: redirect,
        state: "state-1",
        scope: "read:user user:email",
      };
      for (const [key, value] of Object.entries(query)) authorize.searchParams.set(key, value);
      const back = new URL((await fetch(authorize, { redirect: "manual" })).headers.get("location") ?? "");
      const token = await fetch(`${github.url}/login/oauth/access_token`, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: github.oauth.clientId,
          client_secret: github.oauth.clientSecret,
          code: back.searchParams.get("code") ?? "",
          redirect_uri: redirect,
        }),
      });
      const { access_token } = (await token.json()) as { access_token: string };
      const headers = { authorization: `Bearer ${access_token}` };
      const user = (await (await fetch(`${github.url}/user`, { headers })).json()) as { login: string; name: string };
      const emails = (await (await fetch(`${github.url}/user/emails`, { headers })).json()) as {
        email: string;
        primary: boolean;
        verified: boolean;
      }[];
      const primary = emails.find((each) => each.primary);
      signedIn = {
        state: back.searchParams.get("state"),
        login: user.login,
        name: user.name,
        email: primary?.email,
        verified: primary?.verified,
      };
    },
  );

  await then("they come back, the email as verified", async () => {
    expect(signedIn).toEqual({ state: "state-1", login: "ada", name: "Ada", email: "ada@acme.dev", verified: true });
  });
});
