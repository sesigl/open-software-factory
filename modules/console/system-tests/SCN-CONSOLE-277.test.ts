import { type Page, scenario } from "@opensoftware/testkit";
import { serving } from "./console.ts";
import { signInEnv } from "./signin.ts";
import { IMPORT, workItemOf } from "./work.ts";

scenario("SCN-CONSOLE-277", async ({ sut, fakes, given, when, then }) => {
  let intake: Awaited<ReturnType<typeof fakes.http>>;
  await given("a console that signs in with OpenID Connect, with an intake", async () => {
    const setup = await signInEnv(sut, fakes);
    intake = await fakes.http([{ path: "/v1/inbox", body: { workItems: [workItemOf(IMPORT)] } }]);
    await serving(sut, [setup.env.CONSOLE_FOREMAN_URL as string], { ...setup.env, CONSOLE_INTAKE_URL: intake.url });
  });

  let page: Page;
  await when('a person who is signed out asks "/work/items"', async () => {
    page = await sut.pages.open("/work/items");
  });

  await then('the answer redirects to "/signin?next=%2Fwork%2Fitems" and intake was asked for nothing', async () => {
    expect([page.status, page.path]).toEqual([200, "/signin?next=%2Fwork%2Fitems"]);
    expect(intake.requests()).toEqual([]);
  });
});
