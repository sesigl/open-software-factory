// The person of a request (ADR 0134): the hook of the sign-in finds the signed-in person, and the hook of a sign-in
// proxy with an access file the proxy's person with their role. Pages and forms read them here.
import type { FastifyRequest } from "fastify";
import type { Role } from "../adapters/access.ts";
import type { SignIn } from "../domain/signin.ts";

export interface SignedPerson {
  email: string;
  name?: string;
  role: Role;
}

const people = new WeakMap<FastifyRequest, SignedPerson>();
const proxied = new WeakMap<FastifyRequest, SignedPerson>();

/** The person the hook of the own sign-in found for this request, with their role. */
export const personOf = (request: FastifyRequest): SignedPerson | undefined => people.get(request);

/** Records the signed-in person of the request. */
export const setPerson = (request: FastifyRequest, person: SignedPerson): void => {
  people.set(request, person);
};

/** Records the person of the sign-in proxy's header with their role in the access file. */
export const setProxied = (request: FastifyRequest, person: SignedPerson): void => {
  proxied.set(request, person);
};

/** The person of the request with their role, in a mode with roles: the own sign-in, or a proxy with an access file. */
export const actorOf = (request: FastifyRequest): SignedPerson | undefined =>
  people.get(request) ?? proxied.get(request);

/** Whether the form came from the console's own address: with the sign-in, it must say so in `Origin`. */
export const fromConsole = (request: FastifyRequest, sign: SignIn): boolean =>
  request.headers.origin === new URL(sign.url).origin;
