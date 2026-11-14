import { scenario } from "@opensoftware/testkit";
import { serving } from "./console.ts";
import { signedIn, signInEnv } from "./signin.ts";

scenario("SCN-CONSOLE-138", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof signInEnv>>;
  await given(
    'a console that signs in with OpenID Connect and an access file with "ada@acme.dev" as "admin"',
    async () => {
      setup = await signInEnv(sut, fakes);
      await serving(sut, [setup.env.CONSOLE_FOREMAN_URL as string], setup.env);
    },
  );

  await given('the provider signs in "leo@acme.dev"', async () => {
    setup.oidc.signIn({ email: "leo@acme.dev" });
  });

  let page: Awaited<ReturnType<typeof signedIn>>;
  await when('the person opens "/" and presses "Sign in"', async () => {
    page = await signedIn(sut);
  });

  await then(
    'the page answers 403 and says "leo@acme.dev is not on this factory\'s access list" and where the list lives',
    async () => {
      expect(page.status).toBe(403);
      expect(page.getByRole("alert").text).toBe("leo@acme.dev is not on this factory's access list");
      expect(page.text).toContain(
        `The access list is ${sut.files.path("$INPUT/access.yaml")} in the factory's repository.`,
      );
    },
  );
});
