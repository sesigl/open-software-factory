import { scenario } from "@opensoftware/testkit";
import { type Store, store, VALUE } from "./store.ts";

scenario("SCN-SOPENBAO-002", async ({ sut, fakes, given, when, then }) => {
  let box: Store;
  let write = "";
  let read = "";
  await given('the test store, the write token and a token with the policy that "policy read" prints', async () => {
    box = await store(sut, fakes);
    write = await box.token("write");
    read = await box.token("read");
  });

  await given('the client piped "lin_test_51c2" into "put linear-token --by ada"', async () => {
    await box.lines(write, ["put", "linear-token", "--by", "ada"], VALUE);
  });

  let answers: { status: number; body: { data: Record<string, unknown> } }[] = [];
  await when('the test reads "linear-token" and its metadata from OpenBao with the read token', async () => {
    // The reads of the egress proxy and of the foreman's check before a stage.
    answers = await Promise.all(
      ["data", "metadata"].map(async (kind) => {
        const response = await fetch(`${box.bao.url}/v1/${box.bao.mount}/${kind}/linear-token`, {
          headers: { "x-vault-token": read },
        });
        return { status: response.status, body: (await response.json()) as { data: Record<string, unknown> } };
      }),
    );
  });

  await then('OpenBao answers the value "lin_test_51c2" and the metadata with the person "ada"', async () => {
    const [value, metadata] = answers;
    expect(value?.status).toBe(200);
    expect(value?.body.data.data).toEqual({ value: VALUE });
    expect(metadata?.status).toBe(200);
    expect(metadata?.body.data.custom_metadata).toEqual({ changed_by: "ada" });
  });
});
