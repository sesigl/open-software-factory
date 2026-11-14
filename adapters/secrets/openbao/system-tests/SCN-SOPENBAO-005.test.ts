import { scenario } from "@opensoftware/testkit";

scenario("SCN-SOPENBAO-005", async ({ sut, when, then }) => {
  let withoutAddress: Awaited<ReturnType<typeof sut.cli>>;
  let withoutToken: Awaited<ReturnType<typeof sut.cli>>;
  await when('the client runs "list" without "OSF_OPENBAO_ADDR", and "list" without "OSF_OPENBAO_TOKEN"', async () => {
    withoutAddress = await sut.cli(["list"], { env: { OSF_OPENBAO_TOKEN: "osf-test-unknown-token" } });
    withoutToken = await sut.cli(["list"], { env: { OSF_OPENBAO_ADDR: "http://127.0.0.1:9" } });
  });

  await then(
    'the first exits with code 2 and the error "set OSF_OPENBAO_ADDR to OpenBao\'s address, like http://127.0.0.1:8200"',
    async () => {
      expect([withoutAddress.exitCode, withoutAddress.stderr]).toEqual([
        2,
        "secrets-openbao: set OSF_OPENBAO_ADDR to OpenBao's address, like http://127.0.0.1:8200\n",
      ]);
    },
  );

  await then('the second exits with code 2 and the error "set OSF_OPENBAO_TOKEN to an OpenBao token"', async () => {
    expect([withoutToken.exitCode, withoutToken.stderr]).toEqual([
      2,
      "secrets-openbao: set OSF_OPENBAO_TOKEN to an OpenBao token\n",
    ]);
  });
});
