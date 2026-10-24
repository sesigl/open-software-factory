import { scenario } from "@opensoftware/testkit";
import { setup } from "./forge.ts";

scenario("SCN-FORGE-011", async ({ sut, fakes, when, then }) => {
  const box = await setup(sut, fakes);
  let printed: Record<string, unknown>;
  await when('the client runs "webhook tester/web http://intake.example/forge"', async () => {
    printed = await box.json(["webhook", "tester/web", "http://intake.example/forge"]);
  });

  await then(
    'the test forge has one active webhook of "tester/web" to "http://intake.example/forge" for pull request events',
    async () => {
      const hooks = await box.forge.hooks("web");
      expect(hooks).toEqual([
        {
          url: "http://intake.example/forge",
          active: true,
          events: ["issue_comment", "pull_request", "pull_request_review"],
        },
      ]);
      expect(printed).toEqual({
        id: expect.any(Number),
        url: "http://intake.example/forge",
        events: ["issue_comment", "pull_request", "pull_request_review"],
        active: true,
      });
    },
  );
});
