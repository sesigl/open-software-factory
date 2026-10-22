import { scenario } from "@opensoftware/testkit";

scenario("SCN-GATE-037", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper keys"', async () => {
    run = await sut.cli(["keys"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('the output names the files "$OUTPUT/gatekeeper.pem" and "$OUTPUT/gatekeeper.pub"', async () => {
    expect(run.stdout).toMatch(/^wrote the private key .*gatekeeper\.pem and the public key .*gatekeeper\.pub$/m);
    expect((await sut.files.list("$OUTPUT")).sort()).toEqual(["gatekeeper.pem", "gatekeeper.pub"]);
  });

  await then(
    '"$OUTPUT/gatekeeper.pem" holds an Ed25519 private key and "$OUTPUT/gatekeeper.pub" its public key in PEM',
    async () => {
      // The DER of an Ed25519 key names the algorithm 1.3.101.112: 06 03 2b 65 70.
      const der = (pem: string) => Buffer.from(pem.replace(/-----[^-]+-----|\s/g, ""), "base64").toString("hex");
      const pem = await sut.files.read("$OUTPUT/gatekeeper.pem");
      const pub = await sut.files.read("$OUTPUT/gatekeeper.pub");
      expect(pem).toMatch(/^-----BEGIN PRIVATE KEY-----\n[\s\S]+\n-----END PRIVATE KEY-----\n$/);
      expect(pub).toMatch(/^-----BEGIN PUBLIC KEY-----\n[\s\S]+\n-----END PUBLIC KEY-----\n$/);
      expect(der(pem)).toContain("06032b6570");
      expect(der(pub)).toMatch(/^302a300506032b6570032100[0-9a-f]{64}$/);
    },
  );
});
