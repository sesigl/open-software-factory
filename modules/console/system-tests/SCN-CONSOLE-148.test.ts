import { scenario } from "@opensoftware/testkit";
import { factoryEnv, foreman, serving } from "./console.ts";
import { accessYaml, SESSION_KEY } from "./signin.ts";

scenario("SCN-CONSOLE-148", async ({ sut, fakes, given, when, then }) => {
  let github: Awaited<ReturnType<typeof fakes.github>>;
  await given('a console that signs in with GitHub and an access file with "ada@acme.dev" as "admin"', async () => {
    github = await fakes.github();
    await sut.files.put("$INPUT/access.yaml", accessYaml());
    const api = await foreman(fakes, []);
    await serving(sut, [api.url], {
      ...(await factoryEnv(sut)),
      CONSOLE_SIGN_IN: "github",
      CONSOLE_SESSION_SECRET: SESSION_KEY,
      CONSOLE_GITHUB_CLIENT_ID: github.oauth.clientId,
      CONSOLE_GITHUB_CLIENT_SECRET: github.oauth.clientSecret,
      CONSOLE_GITHUB_URL: github.url,
      CONSOLE_GITHUB_API_URL: github.url,
    });
  });

  await given('GitHub signs in "ada" with the verified primary email "ada@acme.dev"', async () => {
    github.signIn({ login: "ada", email: "ada@acme.dev", name: "Ada" });
  });

  let page: Awaited<ReturnType<typeof sut.pages.open>>;
  await when('the person opens "/" and presses "Sign in with GitHub"', async () => {
    page = await (await sut.pages.open("/")).follow("Sign in with GitHub");
  });

  await then(
    'the person lands on "/" with the heading "Runs" and "ada@acme.dev · admin" in the navigation',
    async () => {
      expect([page.path, page.getByRole("heading", { level: 1 }).text]).toEqual(["/", "Runs"]);
      expect(page.getByRole("banner").getByText("ada@acme.dev · admin").text).toBe("ada@acme.dev · admin");
    },
  );
});
