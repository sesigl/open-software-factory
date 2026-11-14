import { scenario } from "@opensoftware/testkit";
import { type Store, store, VALUE } from "./store.ts";

scenario("SCN-SECRET-010", async ({ sut, fakes, given, when, then }) => {
  let box: Store;
  let token = "";
  await given("the test store and the write token", async () => {
    box = await store(sut, fakes);
    token = await box.token("write");
  });

  await given('the client piped "lin_test_51c2" into "put linear-token --by ada"', async () => {
    await box.lines(token, ["put", "linear-token", "--by", "ada"], VALUE);
  });

  let status = 0;
  let body = "";
  await when('the test reads the value of "linear-token" from the test store with the write token', async () => {
    // The read the egress proxy makes: OpenBao's KV version 2 API.
    const response = await fetch(`${box.bao.url}/v1/${box.bao.mount}/data/linear-token`, {
      headers: { "x-vault-token": token },
    });
    status = response.status;
    body = await response.text();
  });

  await then("the test store refuses the read", async () => {
    expect(status).toBe(403);
    expect(body).not.toContain(VALUE);
  });
});
