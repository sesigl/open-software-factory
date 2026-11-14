import { scenario } from "@opensoftware/testkit";

scenario("SCN-SOPENBAO-001", async ({ sut, given, when, then }) => {
  await given('no variable "OSF_OPENBAO_MOUNT"', async () => {
    // The test passes the adapter only the variables it names; this one is not among them.
  });

  let write: Awaited<ReturnType<typeof sut.cli>>;
  let read: Awaited<ReturnType<typeof sut.cli>>;
  await when('the client runs "policy write" and "policy read"', async () => {
    write = await sut.cli(["policy", "write"]);
    read = await sut.cli(["policy", "read"]);
  });

  await then(
    'policy write prints "create" and "update" on "secret/data/*", and "read", "list", "update" and "delete" on "secret/metadata/*"',
    async () => {
      expect(write.exitCode, write.stderr).toBe(0);
      expect(write.stdout).toBe(
        [
          `# The console's token for the mount "secret": it writes, lists and deletes secrets, and cannot read a value.`,
          'path "secret/data/*" {',
          '  capabilities = ["create", "update"]',
          "}",
          'path "secret/metadata/*" {',
          '  capabilities = ["read", "list", "update", "delete"]',
          "}",
          "",
        ].join("\n"),
      );
    },
  );

  await then('policy read prints "read" on "secret/data/*" and on "secret/metadata/*"', async () => {
    expect(read.exitCode, read.stderr).toBe(0);
    expect(read.stdout).toBe(
      [
        `# The egress proxy's token for the mount "secret": it reads each secret and its metadata, and nothing else.`,
        'path "secret/data/*" {',
        '  capabilities = ["read"]',
        "}",
        'path "secret/metadata/*" {',
        '  capabilities = ["read"]',
        "}",
        "",
      ].join("\n"),
    );
  });
});
