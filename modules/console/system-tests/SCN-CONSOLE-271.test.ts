import { type FakeHttp, type HttpResponse, type Page, scenario } from "@opensoftware/testkit";
import { ADA, foreman, healthRoute, RUN, rows, runOf, sendForm, serving } from "./console.ts";
import { posted } from "./proof.ts";

const ADVICE =
  "set CONSOLE_SIGNING_KEY: without it the console sends no proof of the person, and foreman, intake and gatekeeper refuse its actions when they check proofs";

scenario("SCN-CONSOLE-271", async ({ sut, fakes, given, when, then }) => {
  let api: FakeHttp;
  await given(
    'a console with "CONSOLE_USER_HEADER" set to "X-Forwarded-Email" and without "CONSOLE_SIGNING_KEY", and a foreman with a running run',
    async () => {
      const run = runOf("Export reports as CSV");
      const signal = { method: "POST", path: `/v1/runs/${RUN}/signals`, status: 202, body: run };
      api = await foreman(fakes, [run], [healthRoute([{ name: "temporal", ok: true }]), signal]);
      await serving(sut, [api.url], { CONSOLE_USER_HEADER: "X-Forwarded-Email" });
    },
  );

  let keys: HttpResponse;
  let health: Page;
  await when(
    'the person "ada@acme.dev" sends the form "Cancel" of the run, a program asks for "/.well-known/jwks.json" and a person opens "/health"',
    async () => {
      expect((await sendForm(sut, `/runs/${RUN}/signals`, { type: "cancel" }, ADA)).status).toBe(303);
      keys = await sut.http.get("/.well-known/jwks.json");
      health = await sut.pages.open("/health", { headers: ADA });
    },
  );

  await then('the foreman received the signal without the header "OSF-Person"', async () => {
    expect(posted(api)).toEqual([
      { path: `/v1/runs/${RUN}/signals`, proof: undefined, text: expect.stringContaining('"type":"cancel"') },
    ]);
  });

  await then('"/.well-known/jwks.json" answers 404', async () => {
    expect(keys.status).toBe(404);
  });

  await then(
    '"/health" has the row "person proof", "warning" and "set CONSOLE_SIGNING_KEY: without it the console sends no proof of the person, and foreman, intake and gatekeeper refuse its actions when they check proofs"',
    async () => {
      expect(rows(health).find(([name]) => name === "person proof")).toEqual(["person proof", "warning", ADVICE]);
    },
  );
});
