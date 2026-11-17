import { type ModelGateway, scenario } from "@opensoftware/testkit";
import { events, stream } from "./model.ts";

scenario("SCN-TK-077", async ({ fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given(
    'fakes.modelGateway with the reply "first" and the reply "second" with the finish reason "content_filter" for requests that contain "fix the typo"',
    async () => {
      gateway = await fakes.modelGateway([
        { when: "fix the typo", reply: "first" },
        { when: "fix the typo", reply: "second", stopReason: "content_filter" },
      ]);
    },
  );

  let outputs: string[] = [];
  await when(
    'a module streams a chat completions call that contains "fix the typo" from the gateway twice',
    async () => {
      for (const _ of [1, 2]) {
        const messages = [{ role: "user", content: "fix the typo" }];
        const choices = (await events(await stream(gateway, "/chat/completions", { messages }))).flatMap(
          (event) => event.choices,
        );
        const text = choices.map((choice) => choice.delta.content ?? "").join("");
        outputs = [...outputs, `${text} ${choices.find((choice) => choice.finish_reason).finish_reason}`];
      }
    },
  );

  await then('the texts and finish reasons are "first stop" and "second content_filter"', async () => {
    expect(outputs).toEqual(["first stop", "second content_filter"]);
  });
});
