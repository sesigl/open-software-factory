import { scenario } from "@opensoftware/testkit";
import { setup } from "./forge.ts";

scenario("SCN-FORGE-022", async ({ sut, fakes, when, then }) => {
  const box = await setup(sut, fakes);
  let printed: Record<string, unknown>;
  await when(
    'the client runs "webhook tester/web http://intake.example/forge --event issue.labeled --event push"',
    async () => {
      const url = "http://intake.example/forge";
      printed = await box.json(["webhook", "tester/web", url, "--event", "issue.labeled", "--event", "push"]);
    },
  );

  await then(
    'the test forge has one active webhook of "tester/web" to "http://intake.example/forge" for the label events of issues and for pushes',
    async () => {
      expect(await box.forge.hooks("web")).toEqual([
        { url: "http://intake.example/forge", active: true, events: ["issues", "push"] },
      ]);
    },
  );

  await then(
    "webhook prints the webhook's ID, its URL, the forge's names of these events and that it is active",
    async () => {
      expect(printed).toEqual({
        id: expect.any(Number),
        url: "http://intake.example/forge",
        events: ["issues", "push"],
        active: true,
      });
    },
  );
});
