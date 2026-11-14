import { scenario } from "@opensoftware/testkit";
import { setup } from "./forge.ts";

/** Bytes that are not UTF-8: a byte order mark, NUL, a lone continuation byte and a broken two-byte sequence. */
const BYTES = Buffer.from([0xff, 0xfe, 0x00, 0x80, 0x41, 0x0a, 0xc3, 0x28]);

scenario("SCN-FORGE-045", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  await given('the branch "console/add-logo" of "tester/web" made from "main"', async () => {
    box = await setup(sut, fakes);
    await box.json(["branch", box.repo, "console/add-logo"]);
  });

  await when(
    "the client runs \"commit tester/web console/add-logo --message 'Add the logo' logo.bin=<file>\" with a file whose bytes are not UTF-8",
    async () => {
      await sut.files.put("$INPUT/logo.bin", BYTES);
      const file = sut.files.path("$INPUT/logo.bin");
      await box.json(["commit", box.repo, "console/add-logo", "--message", "Add the logo", `logo.bin=${file}`]);
    },
  );

  await then('the branch\'s "logo.bin" holds exactly the bytes of the local file', async () => {
    // fakes.forge reads a file as text; Forgejo's raw file API gives its bytes.
    const raw = await fetch(`${box.forge.url}/api/v1/repos/${box.repo}/raw/logo.bin?ref=console%2Fadd-logo`, {
      headers: { authorization: `token ${box.forge.token}` },
    });
    expect(Buffer.from(await raw.arrayBuffer())).toEqual(BYTES);
  });
});
