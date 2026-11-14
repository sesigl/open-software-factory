import { scenario } from "@opensoftware/testkit";
import { factoryEnv, foreman, serving } from "./console.ts";
import { SESSION_KEY, signedIn } from "./signin.ts";

scenario("SCN-CONSOLE-154", async ({ sut, fakes, given, when, then }) => {
  let oidc: Awaited<ReturnType<typeof fakes.oidc>>;
  await given("a console that signs in with OpenID Connect and no access file", async () => {
    oidc = await fakes.oidc();
    const api = await foreman(fakes, []);
    await serving(sut, [api.url], {
      ...(await factoryEnv(sut)),
      CONSOLE_SIGN_IN: "oidc",
      CONSOLE_SESSION_SECRET: SESSION_KEY,
      CONSOLE_OIDC_ISSUER: oidc.url,
      CONSOLE_OIDC_CLIENT_ID: oidc.clientId,
      CONSOLE_OIDC_CLIENT_SECRET: oidc.clientSecret,
    });
  });

  await given('the provider signs in "ada@acme.dev"', async () => {
    oidc.signIn({ email: "ada@acme.dev" });
  });

  let page: Awaited<ReturnType<typeof signedIn>>;
  await when('the person opens "/" and presses "Sign in"', async () => {
    page = await signedIn(sut);
  });

  await then('the page answers 403 and says "Nobody can sign in: <access file>: no such file"', async () => {
    expect(page.status).toBe(403);
    expect(page.getByRole("alert").text).toBe(
      `Nobody can sign in: ${sut.files.path("$INPUT/access.yaml")}: no such file`,
    );
  });
});
