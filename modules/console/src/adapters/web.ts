// Renders a template of src/web/ with Astro's Node adapter in middleware mode (ADR 0132). The route of the request's
// path loads the page's data; Astro's handler gets it as locals.page and writes the response itself.
import { STATUS_CODES } from "node:http";
import type { FastifyReply, FastifyRequest } from "fastify";

interface Locals {
  page: unknown;
  status: number;
  statusText: string;
}
type Handler = (request: unknown, response: unknown, next: undefined, locals: Locals) => Promise<void>;

let loaded: Promise<Handler> | undefined;
/** The handler of the Astro build in dist/web/, loaded at the first page that needs it. */
const handler = (): Promise<Handler> => {
  loaded ??= import(new URL("../web/server/entry.mjs", import.meta.url).href).then(
    (built: { handler: Handler }) => built.handler,
  );
  return loaded;
};

/** Answers the request with the template of its path, which reads `page`, and this status. */
export async function render(
  request: FastifyRequest,
  reply: FastifyReply,
  status: number,
  page: unknown,
): Promise<void> {
  const astro = await handler();
  reply.hijack();
  await astro(request.raw, reply.raw, undefined, { page, status, statusText: STATUS_CODES[status] as string });
}
