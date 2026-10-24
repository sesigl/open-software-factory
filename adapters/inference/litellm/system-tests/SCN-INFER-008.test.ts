import { scenario } from "@opensoftware/testkit";
import { call, calls, config, gateways, provider } from "./gateway.ts";

scenario("SCN-INFER-008", async ({ sut, fakes, given, when, then }) => {
  const company = await provider(fakes, 1);
  const box = gateways(sut);
  try {
    let gateway = { id: "", url: "" };
    await given(
      'a gateway started with "OSF_SECRET_COMPANY_GATEWAY_KEY" set to "gw_real_51c2" from a config that routes "routes/triage" to the company gateway with the key "os.environ/OSF_SECRET_COMPANY_GATEWAY_KEY"',
      async () => {
        const params = ["      api_key: os.environ/OSF_SECRET_COMPANY_GATEWAY_KEY"];
        const routes = [{ alias: "routes/triage", model: "bedrock-claude", params }];
        const env = { OSF_SECRET_COMPANY_GATEWAY_KEY: "gw_real_51c2" };
        gateway = await box.start(config(company.containerUrl as string, routes), env);
      },
    );

    await when('a run calls "routes/triage" with its key', async () => {
      const answer = await call(gateway.url, await box.key(gateway.id, "run-1"), { model: "routes/triage" });
      expect(answer.status, JSON.stringify(answer.body)).toBe(200);
    });

    await then(
      'the company gateway received the call with the header "authorization" "Bearer gw_real_51c2"',
      async () => {
        expect(calls(company).map((request) => request.headers.authorization)).toEqual(["Bearer gw_real_51c2"]);
      },
    );
  } finally {
    await box.stopAll();
  }
});
