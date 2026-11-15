// The page "/secrets", the page that asks before a delete, and their two forms (ADR 0137): only an admin opens them,
// in a console with roles and a store. The console runs the secrets port's adapter for each; a value goes only to
// the standard input of its `put`, and no answer, redirect or note holds one.
import type { ShellData } from "@opensoftware/ui";
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { readFactory } from "../adapters/factory-file.ts";
import { deleteSecret, listSecrets, type Outcome, putSecret } from "../adapters/secrets.ts";
import { render } from "../adapters/web.ts";
import { declaredOf, secretsOf } from "../domain/secrets.ts";
import { deleteData, missingOf, secretsData } from "../pages/secrets.ts";
import { actorOf } from "./person.ts";

/** The most a form of the secrets may send: a key or a token fits many times over. */
const LIMIT = 64 * 1024;

export interface SecretsSetup {
  /** The command line of the secrets port's adapter, CONSOLE_SECRETS_ADAPTER. */
  adapter: string;
  factoryFile: string;
  /** Why this console has no page Secrets, or undefined when it has one. */
  closed: string | undefined;
  /** The shell of a page in the new look for this request. */
  shell(request: FastifyRequest, title: string, current: string, count?: string): ShellData;
  /** The person of a form from the console's own site, or the answer that refuses it (ADR 0089, ADR 0134). */
  signedIn(request: FastifyRequest, reply: FastifyReply, title: string): { person?: string; refused?: unknown };
  /** Answers with a page that names a problem. */
  problem(reply: FastifyReply, status: number, title: string, detail: string): unknown;
}

export function useSecrets(app: FastifyInstance, setup: SecretsSetup): void {
  /** The person who may open the secrets, or the answer that refuses the request: 404 without roles or a store. */
  const guard = (request: FastifyRequest, reply: FastifyReply, form: boolean) => {
    if (setup.closed) return { refused: setup.problem(reply, 404, "No secrets", setup.closed) };
    const signed = form ? setup.signedIn(request, reply, "Secrets") : {};
    if (signed.refused) return signed;
    const actor = actorOf(request);
    if (actor?.role === "admin") return { person: actor.email };
    const who = actor ? `${actor.email} has the role ${actor.role}` : "nobody signed in";
    return { refused: setup.problem(reply, 403, "Forbidden", `${who}: Secrets needs the role admin`) };
  };

  /** The page with the secrets, these notes and the form for the secret of `chosen`. */
  const answer = async (
    request: FastifyRequest,
    reply: FastifyReply,
    status: number,
    notes: string[],
    chosen?: string,
  ) => {
    const declared = declaredOf(readFactory(setup.factoryFile).agents);
    const listed = await listSecrets(setup.adapter);
    const secrets = secretsOf(declared, listed.ok ? listed.body : undefined);
    const all = listed.ok ? notes : [...notes, `The secrets could not be listed: ${listed.note}`];
    const shell = setup.shell(request, "Secrets", "/secrets", missingOf(secrets));
    return render(request, reply, status, secretsData(shell, secrets, all, chosen), "secrets");
  };

  app.get<{ Querystring: { name?: string } }>("/secrets", (request, reply) => {
    const { refused } = guard(request, reply, false);
    return refused ?? answer(request, reply, 200, [], request.query.name);
  });

  app.get<{ Querystring: { name?: string } }>("/secrets/delete", (request, reply) => {
    const { refused } = guard(request, reply, false);
    const name = request.query.name ?? "";
    const shell = setup.shell(request, `Delete ${name}`, "/secrets");
    return refused ?? render(request, reply, 200, deleteData(shell, name), "secrets/delete");
  });

  /** A form that runs the adapter for one secret, then leads back to "/secrets", or shows the page with the problem. */
  const form =
    (failed: string, run: (name: string, person: string, value: string) => Promise<Outcome<unknown>>) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { person, refused } = guard(request, reply, true);
      if (refused) return refused;
      const body = (request.body ?? {}) as Record<string, unknown>;
      const name = String(body.name ?? "");
      const outcome = await run(name, person as string, String(body.value ?? ""));
      if (outcome.ok) return reply.code(303).header("location", "/secrets").send();
      return answer(request, reply, outcome.usage ? 400 : 502, [`${failed}: ${outcome.note}`], name);
    };
  // A form the console cannot read, like one over the limit, is named without a word of what it held, and only to an
  // admin: the hooks ran before the body was read.
  const options = {
    bodyLimit: LIMIT,
    errorHandler: (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
      const { refused } = guard(request, reply, true);
      const why =
        error.statusCode === 413 ? "the form is over its limit of 64 KiB" : "the console could not read the form";
      return refused ?? answer(request, reply, error.statusCode ?? 400, [`Not stored: ${why}`]);
    },
  };
  app.post(
    "/secrets",
    options,
    form("Not stored", (name, person, value) => putSecret(setup.adapter, name, person, value)),
  );
  app.post(
    "/secrets/delete",
    options,
    form("Not deleted", (name) => deleteSecret(setup.adapter, name)),
  );
}
