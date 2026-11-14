import { scenario } from "@opensoftware/testkit";
import { factoryEnv, foreman, open, serving } from "./console.ts";
import { accessYaml } from "./signin.ts";

scenario("SCN-CONSOLE-151", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a console behind a sign-in proxy with "CONSOLE_USER_HEADER" "X-Forwarded-Email" and an access file with "ada@acme.dev" as "admin"',
    async () => {
      await sut.files.put("$INPUT/access.yaml", accessYaml());
      const api = await foreman(fakes, []);
      await serving(sut, [api.url], { ...(await factoryEnv(sut)), CONSOLE_USER_HEADER: "X-Forwarded-Email" });
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when('the proxy sends "leo@acme.dev" to "/"', async () => {
    page = await open(sut, "/", { "x-forwarded-email": "leo@acme.dev" });
  });

  await then(
    'the answer has the status 403 and says "leo@acme.dev is not on this factory\'s access list"',
    async () => {
      expect([page.status, page.text]).toEqual([403, "leo@acme.dev is not on this factory's access list"]);
    },
  );
});
