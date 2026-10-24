import { scenario } from "@opensoftware/testkit";
import { setup } from "./forge.ts";

scenario("SCN-FORGE-023", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  await given('the client ran "webhook tester/web http://intake.example/forge --event push"', async () => {
    box = await setup(sut, fakes);
    await box.json(["webhook", "tester/web", "http://intake.example/forge", "--event", "push"]);
  });

  await when('the client runs "webhook tester/web http://intake.example/forge --event issue_comment"', async () => {
    await box.json(["webhook", "tester/web", "http://intake.example/forge", "--event", "issue_comment"]);
  });

  await then(
    'the test forge has one webhook of "tester/web" to "http://intake.example/forge" for comment events only',
    async () => {
      expect(await box.forge.hooks("web")).toEqual([
        { url: "http://intake.example/forge", active: true, events: ["issue_comment"] },
      ]);
    },
  );
});
