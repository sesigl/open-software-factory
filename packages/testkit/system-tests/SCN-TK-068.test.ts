import { type ModelGateway, scenario } from "@opensoftware/testkit";
import { messages } from "./model.ts";

scenario("SCN-TK-068", async ({ fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given('fakes.modelGateway with a reply that hangs for a request that contains "add a date"', async () => {
    gateway = await fakes.modelGateway([{ when: "add a date", reply: "", hangs: true }]);
  });

  let outcome = "";
  await when(
    'a module sends "add a date" to the Anthropic Messages endpoint of the gateway and gives up after 500 milliseconds',
    async () => {
      outcome = await messages(gateway, "add a date", {}, AbortSignal.timeout(500)).then(
        () => "answered",
        () => "gave up",
      );
    },
  );

  await then("the module gave up without an answer", async () => {
    expect(outcome).toBe("gave up");
  });
});
