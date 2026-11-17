import { type ModelGateway, scenario } from "@opensoftware/testkit";
import { stream } from "./model.ts";

scenario("SCN-TK-075", async ({ fakes, given, when, then }) => {
  let gateway: ModelGateway;
  await given('fakes.modelGateway with a reply that hangs for a request that contains "add a date"', async () => {
    gateway = await fakes.modelGateway([{ when: "add a date", reply: "", hangs: true }]);
  });

  let outcome = "";
  await when(
    'a module sends "add a date" to the Responses API of the gateway and gives up after 500 milliseconds',
    async () => {
      const input = [{ role: "user", content: "add a date" }];
      outcome = await stream(gateway, "/responses", { input }, AbortSignal.timeout(500)).then(
        async (response) => `answered ${await response.text()}`,
        () => "gave up",
      );
    },
  );

  await then("the module gave up without an answer", async () => {
    expect(outcome).toBe("gave up");
  });
});
