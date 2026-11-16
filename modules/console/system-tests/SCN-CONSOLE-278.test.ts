import { scenario } from "@opensoftware/testkit";
import { factoryEnv, foreman, open, serving } from "./console.ts";
import { accessYaml } from "./signin.ts";
import { IMPORT, workItemOf } from "./work.ts";

scenario("SCN-CONSOLE-278", async ({ sut, fakes, given, when, then }) => {
  let intake: Awaited<ReturnType<typeof fakes.http>>;
  await given(
    'a console behind a sign-in proxy with "CONSOLE_USER_HEADER" "X-Forwarded-Email", an access file with "ada@acme.dev" as "admin", and an intake',
    async () => {
      await sut.files.put("$INPUT/access.yaml", accessYaml());
      intake = await fakes.http([{ path: "/v1/inbox", body: { workItems: [workItemOf(IMPORT)] } }]);
      await serving(sut, [(await foreman(fakes, [])).url], {
        ...(await factoryEnv(sut)),
        CONSOLE_USER_HEADER: "X-Forwarded-Email",
        CONSOLE_INTAKE_URL: intake.url,
      });
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when('the proxy sends "leo@acme.dev" to "/work/items"', async () => {
    page = await open(sut, "/work/items", { "x-forwarded-email": "leo@acme.dev" });
  });

  await then(
    'the answer has the status 403 and says "leo@acme.dev is not on this factory\'s access list", and intake was asked for nothing',
    async () => {
      expect([page.status, page.text]).toEqual([403, "leo@acme.dev is not on this factory's access list"]);
      expect(intake.requests()).toEqual([]);
    },
  );
});
