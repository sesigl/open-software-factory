// The signed-in person of a request (ADR 0134): the hook of the sign-in finds them; pages and forms read them here.
import type { FastifyRequest } from "fastify";
import type { Role } from "../adapters/access.ts";
import type { SignIn } from "../domain/signin.ts";

export interface SignedPerson {
  email: string;
  name?: string;
  role: Role;
}

const people = new WeakMap<FastifyRequest, SignedPerson>();

/** The person the hook found for this request, with their role. */
export const personOf = (request: FastifyRequest): SignedPerson | undefined => people.get(request);

/** Records the person of the request. */
export const setPerson = (request: FastifyRequest, person: SignedPerson): void => {
  people.set(request, person);
};

/** Whether the form came from the console's own address: with the sign-in, it must say so in `Origin`. */
export const fromConsole = (request: FastifyRequest, sign: SignIn): boolean =>
  request.headers.origin === new URL(sign.url).origin;
