// The console's own sign-in (ADR 0134): one hook in front of every page finds the person in the session cookie and
// their role in the access file, and the routes of the sign-in, its callback and the sign-out.
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { type AccessList, accessFile, type Role } from "../adapters/access.ts";
import { providerOf } from "../adapters/providers.ts";
import { cookieOf, seal, setCookie, unseal } from "../adapters/session.ts";
import { render } from "../adapters/web.ts";
import { type SignIn, safeNext } from "../domain/signin.ts";
import { signInData } from "../pages/signin.ts";
import { setPerson } from "./person.ts";

const SESSION = "osf_session";
const FLOW = "osf_signin";
const FLOW_SECONDS = 600;
/** The paths a person reaches without a session. */
const OPEN = new Set(["/signin", "/signin/start", "/signin/callback", "/pico.css", "/v1/ready"]);

/** Registers the hook and the routes of the sign-in on the console's server. */
export function useSignIn(app: FastifyInstance, sign: SignIn, accessPath: string, now: () => number): void {
  const provider = providerOf(sign, now);
  const access = accessFile(accessPath, now);
  const address = new URL(sign.url);
  const where = `The access list is ${accessPath} in the factory's repository.`;

  const signInPage = (request: FastifyRequest, reply: FastifyReply, status: number, next: string, refusal = "") =>
    render(request, reply, status, signInData(sign.provider, next, refusal, refusal ? where : ""), "signin");

  const refusalOf = (list: AccessList, email: string): string | undefined => {
    if (list.problems.length) return `Nobody can sign in: ${list.problems.join("; ")}`;
    if (!list.roleOf(email)) return `${email} is not on this factory's access list`;
    return undefined;
  };

  app.addHook("onRequest", async (request, reply) => {
    // A request for another host is sent to the console's own address first, so the cookies stay on one host.
    if (request.headers.host !== address.host)
      return reply.code(307).header("location", `${sign.url}${request.url}`).send();
    const path = request.url.split("?")[0] ?? "/";
    if (OPEN.has(path)) return;
    const claims = await unseal(cookieOf(request.headers.cookie, SESSION), sign.keys, now());
    const email = typeof claims?.email === "string" ? claims.email : "";
    if (!email) {
      if (request.method === "GET" || request.method === "HEAD")
        return reply
          .code(303)
          .header("location", `/signin?next=${encodeURIComponent(request.url)}`)
          .send();
      return reply.code(401).type("text/plain").send("sign in first");
    }
    const list = access.current();
    const refusal = refusalOf(list, email);
    if (refusal) return signInPage(request, reply, 403, "/", refusal);
    const name = typeof claims?.name === "string" ? claims.name : undefined;
    setPerson(request, { email, ...(name ? { name } : {}), role: list.roleOf(email) as Role });
  });

  app.get<{ Querystring: { next?: string } }>("/signin", (request, reply) =>
    signInPage(request, reply, 200, safeNext(request.query.next)),
  );

  app.get<{ Querystring: { next?: string } }>("/signin/start", async (request, reply) => {
    const { url, flow } = await provider.begin();
    const next = safeNext(request.query.next);
    const cookie = await seal({ flow, next }, sign.keys, now(), FLOW_SECONDS);
    return reply
      .code(303)
      .header("set-cookie", setCookie(FLOW, cookie, sign.url, FLOW_SECONDS))
      .header("location", url)
      .send();
  });

  app.get("/signin/callback", async (request, reply) => {
    const started = await unseal(cookieOf(request.headers.cookie, FLOW), sign.keys, now());
    reply.header("set-cookie", setCookie(FLOW, "", sign.url, 0));
    if (!started)
      return signInPage(request, reply, 400, "/", "The sign-in took too long or did not start here: sign in again");
    const flow = started.flow as Parameters<typeof provider.finish>[1];
    const next = safeNext(String(started.next ?? "/"));
    const person = await provider
      .finish(new URL(request.url, sign.url), flow)
      .catch((error: Error) => ({ failed: error.message }) as const);
    if ("failed" in person)
      return signInPage(request, reply, 403, next, `The provider refused the sign-in: ${person.failed}`);
    const email = person.email.toLowerCase();
    if (!person.verified) return signInPage(request, reply, 403, next, `The provider has not verified ${email}`);
    const refusal = refusalOf(access.current(), email);
    if (refusal) return signInPage(request, reply, 403, next, refusal);
    const session = await seal(
      { email, ...(person.name ? { name: person.name } : {}) },
      sign.keys,
      now(),
      sign.seconds,
    );
    // Fastify adds a second set-cookie to the one that ends the sign-in's cookie.
    reply.header("set-cookie", setCookie(SESSION, session, sign.url, sign.seconds));
    return reply.code(303).header("location", next).send();
  });

  app.post("/signout", (_request, reply) =>
    reply
      .code(303)
      .header("set-cookie", setCookie(SESSION, "", sign.url, 0))
      .header("location", "/signin")
      .send(),
  );
}

/**
 * Behind a sign-in proxy with an access file (ADR 0130, ADR 0134): the person of the proxy's header must be on the list,
 * else every page answers 403 and names them. Without the header the pages stay as without the file.
 */
export function useProxyAccess(app: FastifyInstance, header: string, accessPath: string, now: () => number): void {
  const access = accessFile(accessPath, now);
  app.addHook("onRequest", async (request, reply) => {
    const email = String(request.headers[header] ?? "");
    if (!email) return;
    const list = access.current();
    if (list.roleOf(email)) return;
    const refusal = list.problems.length
      ? `Nobody may use this console: ${list.problems.join("; ")}`
      : `${email} is not on this factory's access list`;
    return reply.code(403).type("text/plain; charset=utf-8").send(refusal);
  });
}
