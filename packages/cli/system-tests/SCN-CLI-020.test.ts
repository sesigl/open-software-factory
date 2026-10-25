import { runAdapter } from "@opensoftware/cli";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-CLI-020", async ({ when, then }) => {
  let run: Promise<unknown[]>;
  await when('the module runs the "forge adapter" "/opt/missing/forge-forgejo" with "hooks acme/web"', async () => {
    const adapter = { name: "forge adapter", command: "/opt/missing/forge-forgejo", env: process.env };
    run = runAdapter(adapter, ["hooks", "acme/web"]);
    run.catch(() => undefined);
  });

  await then('it gets the error "could not start the forge adapter /opt/missing/forge-forgejo (ENOENT)"', async () => {
    await expect(run).rejects.toThrow(/^could not start the forge adapter \/opt\/missing\/forge-forgejo \(ENOENT\)$/);
  });
});
