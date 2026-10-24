import { scenario } from "@opensoftware/testkit";
import { setup } from "./forge.ts";

scenario("SCN-FORGE-012", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let first: Record<string, unknown>;
  await given('the client ran "webhook tester/web http://intake.example/forge"', async () => {
    box = await setup(sut, fakes);
    first = await box.json(["webhook", "tester/web", "http://intake.example/forge"]);
  });

  let second: Record<string, unknown>;
  await when('the client runs "webhook tester/web http://intake.example/forge" again', async () => {
    second = await box.json(["webhook", "tester/web", "http://intake.example/forge"]);
  });

  await then('the test forge has one webhook of "tester/web" to "http://intake.example/forge"', async () => {
    expect((await box.forge.hooks("web")).map((hook) => hook.url)).toEqual(["http://intake.example/forge"]);
    expect(second).toEqual(first);
  });
});
