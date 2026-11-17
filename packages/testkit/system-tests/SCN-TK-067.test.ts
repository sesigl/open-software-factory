import { type ModelGateway, scenario } from "@opensoftware/testkit";
import { json, messages } from "./model.ts";

scenario("SCN-TK-067", async ({ fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given(
    'fakes.modelGateway with the replies "first" and "second" for requests that contain "fix the typo"',
    async () => {
      gateway = await fakes.modelGateway([
        { when: "fix the typo", reply: "first" },
        { when: "fix the typo", reply: "second" },
      ]);
    },
  );

  let texts: string[] = [];
  await when(
    'a module sends "fix the typo" to the Anthropic Messages endpoint of the gateway three times',
    async () => {
      for (let i = 0; i < 3; i++) {
        const { content } = await json(messages(gateway, "fix the typo"));
        texts = [...texts, content[0].text];
      }
    },
  );

  await then('the texts are "first", "second" and "second"', async () => {
    expect(texts).toEqual(["first", "second", "second"]);
  });
});
