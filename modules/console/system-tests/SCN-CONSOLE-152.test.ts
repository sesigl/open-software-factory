import { scenario } from "@opensoftware/testkit";
import { factoryEnv, foreman, open, serving } from "./console.ts";
import { accessYaml } from "./signin.ts";

scenario("SCN-CONSOLE-152", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a console behind a sign-in proxy with "CONSOLE_USER_HEADER" "X-Forwarded-Email" and an access file with "ada@acme.dev" as "admin"',
    async () => {
      await sut.files.put("$INPUT/access.yaml", accessYaml());
      const api = await foreman(fakes, []);
      await serving(sut, [api.url], { ...(await factoryEnv(sut)), CONSOLE_USER_HEADER: "X-Forwarded-Email" });
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when('the proxy sends "Ada@acme.dev" to "/"', async () => {
    page = await open(sut, "/", { "x-forwarded-email": "Ada@acme.dev" });
  });

  await then('the page answers 200 with the heading "Runs"', async () => {
    expect([page.status, page.getByRole("heading", { level: 1 }).text]).toEqual([200, "Runs"]);
  });
});
