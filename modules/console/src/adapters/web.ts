// Renders a template of src/web/ with Astro's Node adapter in middleware mode (ADR 0132). The route of the request's
// path loads the page's data; Astro's handler gets it as locals.page and writes the response itself.
import { readFileSync } from "node:fs";
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

/** Answers the request with the template of its path, or of `template`, which reads `page`, and this status. */
export async function render(
  request: FastifyRequest,
  reply: FastifyReply,
  status: number,
  page: unknown,
  template?: string,
): Promise<void> {
  const astro = await handler();
  // Astro writes the answer itself: the headers the route set, like a cookie, go to the answer first.
  for (const [name, value] of Object.entries(reply.getHeaders()))
    if (value !== undefined) reply.raw.setHeader(name, value);
  reply.hijack();
  // Astro picks the template by the request's path.
  if (template) request.raw.url = `/${template}`;
  await astro(request.raw, reply.raw, undefined, { page, status, statusText: STATUS_CODES[status] as string });
}

const TYPES: Record<string, string> = {
  css: "text/css; charset=utf-8",
  woff2: "font/woff2",
  woff: "font/woff",
  svg: "image/svg+xml",
};

/** A file that Astro's build wrote to dist/web/client/_astro/, by its name, or undefined for another name. */
export function builtAsset(file: string): { type: string; body: Buffer } | undefined {
  const type = TYPES[file.split(".").pop() ?? ""];
  if (!type || !/^[\w.-]+$/.test(file)) return undefined;
  try {
    return { type, body: readFileSync(new URL(`../web/client/_astro/${file}`, import.meta.url)) };
  } catch {
    return undefined;
  }
}
