import { scenario } from "@opensoftware/testkit";
import { foreman, open, RUN, runOf, serving } from "./console.ts";

scenario("SCN-CONSOLE-080", async ({ sut, fakes, given, when, then }) => {
  await given(
    'a foreman with a run that "ada@acme.dev" steered with "use the existing date helper" and "Leo" cancelled',
    async () => {
      const run = runOf("Add a dark mode", {
        state: "cancelled",
        actions: [
          {
            type: "steer",
            message: "use the existing date helper",
            by: { kind: "person", id: "ada@acme.dev" },
            at: "2026-01-01T00:01:00.000Z",
          },
          {
            type: "cancel",
            by: { kind: "person", id: "leo@acme.dev", displayName: "Leo" },
            at: "2026-01-01T00:02:00.000Z",
          },
        ],
      });
      await serving(sut, [(await foreman(fakes, [run])).url]);
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when("a person opens the run's page", async () => {
    page = await open(sut, `/runs/${RUN}`);
  });

  await then(
    'the section "Actions" lists "steer: use the existing date helper by ada@acme.dev at 2026-01-01T00:01:00.000Z" and "cancel by Leo at 2026-01-01T00:02:00.000Z"',
    async () => {
      expect(page.getByRole("heading", { name: "Actions" }).text).toBe("Actions");
      const lists = page.getByRole("main").getAllByRole("list");
      const actions = lists.find((list) => list.getAllByRole("listitem")[0]?.text.startsWith("steer"));
      expect(actions?.getAllByRole("listitem").map((item) => item.text)).toEqual([
        "steer: use the existing date helper by ada@acme.dev at 2026-01-01T00:01:00.000Z",
        "cancel by Leo at 2026-01-01T00:02:00.000Z",
      ]);
    },
  );
});
