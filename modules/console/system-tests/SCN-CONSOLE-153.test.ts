import { scenario } from "@opensoftware/testkit";
import { serving } from "./console.ts";
import { signInEnv } from "./signin.ts";

scenario("SCN-CONSOLE-153", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a console that signs in with OpenID Connect and an access file with "ada@acme.dev" as "admin"',
    async () => {
      const setup = await signInEnv(sut, fakes);
      await serving(sut, [setup.env.CONSOLE_FOREMAN_URL as string], setup.env);
    },
  );

  let page: Awaited<ReturnType<typeof sut.pages.open>>;
  await when('a person opens "/signin"', async () => {
    page = await sut.pages.open("/signin");
  });

  await then(
    'the page\'s stylesheet is a file of the console that answers 200 with "text/css" and names the tokens',
    async () => {
      const [stylesheet] = page.stylesheets;
      expect(stylesheet).toMatch(/^\/_astro\/[\w.-]+\.css$/);
      const css = await sut.http.get(stylesheet as string);
      expect([css.status, css.headers["content-type"]]).toEqual([200, "text/css; charset=utf-8"]);
      expect(String(css.body)).toContain("--osf-signal:#ff6b1a");
    },
  );

  await then("the console serves the favicon of the design system", async () => {
    const icon = await sut.http.get("/favicon.svg");
    expect([icon.status, icon.headers["content-type"]]).toEqual([200, "image/svg+xml"]);
    expect(String(icon.body)).toContain("M4 27V15l8-6v6l8-6v6l8-6v18H4z");
  });
});
