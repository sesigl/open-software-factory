import { scenario } from "@opensoftware/testkit";
import { foreman, healthRoute, open, runOf, serving } from "./console.ts";

const POLICY =
  "default-src 'self'; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

scenario("SCN-CONSOLE-267", async ({ sut, fakes, given, when, then }) => {
  let api: Awaited<ReturnType<typeof foreman>>;
  await given('a foreman with the run "Export reports as CSV"', async () => {
    api = await foreman(fakes, [runOf("Export reports as CSV")], [healthRoute([])]);
  });

  let policies: (string | undefined)[] = [];
  let statuses: number[] = [];
  await when('a person opens "/", "/health", "/favicon.svg" and "/pico.css"', async () => {
    await serving(sut, [api.url]);
    const pages = [await open(sut, "/"), await open(sut, "/health")];
    const files = [await sut.http.get("/favicon.svg"), await sut.http.get("/pico.css")];
    policies = [...pages, ...files].map((answer) => answer.headers["content-security-policy"]);
    statuses = files.map((answer) => answer.status);
  });

  await then(
    "each answer has the Content-Security-Policy \"default-src 'self'; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'\"",
    async () => {
      expect(policies).toEqual([POLICY, POLICY, POLICY, POLICY]);
    },
  );

  await then('"/favicon.svg" answers 200 and "/pico.css" answers 404', async () => {
    expect(statuses).toEqual([200, 404]);
  });
});
