import { scenario } from "@opensoftware/testkit";
import { setup } from "./forge.ts";

scenario("SCN-FORGE-025", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let registered: Record<string, unknown>;
  await given('the client ran "webhook tester/web http://intake.example/forge"', async () => {
    box = await setup(sut, fakes);
    registered = await box.json(["webhook", "tester/web", "http://intake.example/forge"]);
  });

  let printed: Record<string, unknown>;
  await when('the client runs "unhook" with the ID that webhook printed', async () => {
    printed = await box.json(["unhook", "tester/web", String(registered.id)]);
  });

  await then('unhook prints the ID and "removed" true', async () => {
    expect(printed).toEqual({ id: registered.id, removed: true });
  });

  await then('the test forge has no webhook of "tester/web"', async () => {
    expect(await box.forge.hooks("web")).toEqual([]);
  });
});
