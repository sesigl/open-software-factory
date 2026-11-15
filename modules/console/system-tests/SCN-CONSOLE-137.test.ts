import { type Page, scenario } from "@opensoftware/testkit";
import { navLinks, serving } from "./console.ts";
import { signInEnv } from "./signin.ts";

scenario("SCN-CONSOLE-137", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof signInEnv>>;
  await given(
    'a console that signs in with OpenID Connect and an access file with "ada@acme.dev" as "admin"',
    async () => {
      setup = await signInEnv(sut, fakes);
      await serving(sut, [setup.env.CONSOLE_FOREMAN_URL as string], setup.env);
    },
  );

  await given('the provider signs in "ada@acme.dev"', async () => {
    setup.oidc.signIn({ email: "ada@acme.dev", name: "Ada" });
  });

  let first: Page;
  let landed: Page;
  await when('the person opens "/" on 127.0.0.1 and presses "Sign in"', async () => {
    first = await sut.pages.open("/");
    landed = await first.follow("Sign in");
  });

  await then('the console sent the person to its address "http://localhost:<port>" and to "/signin"', async () => {
    const port = new URL(sut.http.url()).port;
    const redirect = await fetch(`${sut.http.url()}/`, { redirect: "manual" });
    expect([redirect.status, redirect.headers.get("location")]).toEqual([307, `http://localhost:${port}/`]);
    expect(first.path).toBe("/signin?next=%2F");
  });

  await then(
    'the person lands on "/" with the heading "Runs" and "ada@acme.dev · admin" in the navigation',
    async () => {
      expect(landed.path).toBe("/");
      expect(landed.getByRole("heading", { level: 1 }).text).toBe("Runs");
      expect(landed.getByRole("banner").getByText("ada@acme.dev · admin").text).toBe("ada@acme.dev · admin");
      expect(navLinks(landed).map((link) => link.href)).toEqual(["/", "/skills", "/factory", "/health"]);
    },
  );
});
