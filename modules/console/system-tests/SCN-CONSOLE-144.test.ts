import { scenario } from "@opensoftware/testkit";
import { serving } from "./console.ts";
import { accessYaml, signedIn, signInEnv } from "./signin.ts";

scenario("SCN-CONSOLE-144", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof signInEnv>>;
  await given(
    'a person "varun@acme.dev" signed in as "member" to a console that signs in with OpenID Connect',
    async () => {
      setup = await signInEnv(sut, fakes, { "ada@acme.dev": "admin", "varun@acme.dev": "member" });
      await serving(sut, [setup.env.CONSOLE_FOREMAN_URL as string], setup.env);
      setup.oidc.signIn({ email: "varun@acme.dev" });
      expect((await signedIn(sut)).getByRole("banner").getByText("varun@acme.dev · member").text).toBe(
        "varun@acme.dev · member",
      );
    },
  );

  let page: Awaited<ReturnType<typeof signedIn>>;
  await when('a merge removes "varun@acme.dev" from the access file and the person opens "/"', async () => {
    await sut.files.put("$INPUT/access.yaml", accessYaml({ "ada@acme.dev": "admin" }));
    page = await sut.pages.open("/");
  });

  await then('the page answers 403 and says "varun@acme.dev is not on this factory\'s access list"', async () => {
    expect([page.status, page.getByRole("alert").text]).toEqual([
      403,
      "varun@acme.dev is not on this factory's access list",
    ]);
  });
});
