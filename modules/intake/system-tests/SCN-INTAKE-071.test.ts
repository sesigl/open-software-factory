import { scenario } from "@opensoftware/testkit";
import { proving, workAs } from "./server.ts";

scenario("SCN-INTAKE-071", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof proving>>;
  let portal: Awaited<ReturnType<typeof fakes.personIssuer>>;
  await given(
    'the server runs with "INTAKE_PERSON_KEYS" set to the key sets of the console and of the tool "acme-portal"',
    async () => {
      portal = await fakes.personIssuer({ name: "acme-portal" });
      server = await proving(sut, fakes, {}, [portal.setting]);
    },
  );

  let fromPortal: Awaited<ReturnType<typeof server.post>>;
  let fromOther: Awaited<ReturnType<typeof server.post>>;
  await when(
    '"acme-portal" posts the README\'s "work.json" with its proof of "varun@acme.dev", and "other-portal" posts it with its proof of "grace@acme.dev"',
    async () => {
      const other = await fakes.personIssuer({ name: "other-portal" });
      const varun = workAs(fakes, { kind: "person", id: "varun@acme.dev" });
      const grace = workAs(fakes, { kind: "person", id: "grace@acme.dev" });
      const claims = { aud: "intake", path: "/v1/work-items" };
      fromPortal = await server.post(varun, await portal.prove({ sub: "varun@acme.dev", body: varun, ...claims }));
      fromOther = await server.post(grace, await other.prove({ sub: "grace@acme.dev", body: grace, ...claims }));
    },
  );

  await then(
    'the answer to "acme-portal" has the status 201 and the work item\'s requester is "varun@acme.dev"',
    async () => {
      expect(fromPortal.status, JSON.stringify(fromPortal.body)).toBe(201);
      const { workItem } = fromPortal.body as { workItem: { id: string } };
      expect((await server.workItem(workItem.id))?.workItem.requester).toEqual({
        kind: "person",
        id: "varun@acme.dev",
      });
    },
  );

  await then(
    'the answer to "other-portal" has the status 401 and a detail that names the issuer "other-portal"',
    async () => {
      expect(fromOther).toEqual({
        status: 401,
        body: {
          title: "Unauthorized",
          status: 401,
          detail: 'the person proof\'s issuer "other-portal" is not one of "console", "acme-portal"',
        },
      });
    },
  );
});
