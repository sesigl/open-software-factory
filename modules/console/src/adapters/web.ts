// @ts-nocheck
// Renders a template of src/web/ with Astro's Node adapter in middleware mode (ADR 0132). The route of the request's
// path loads the page's data; Astro's handler gets it as locals.page and writes the response itself.
function stryNS_9fa48() {
  var g = typeof globalThis === 'object' && globalThis && globalThis.Math === Math && globalThis || new Function("return this")();
  var ns = g.__stryker__ || (g.__stryker__ = {});
  if (ns.activeMutant === undefined && g.process && g.process.env && g.process.env.__STRYKER_ACTIVE_MUTANT__) {
    ns.activeMutant = g.process.env.__STRYKER_ACTIVE_MUTANT__;
  }
  function retrieveNS() {
    return ns;
  }
  stryNS_9fa48 = retrieveNS;
  return retrieveNS();
}
stryNS_9fa48();
function stryCov_9fa48() {
  var ns = stryNS_9fa48();
  var cov = ns.mutantCoverage || (ns.mutantCoverage = {
    static: {},
    perTest: {}
  });
  function cover() {
    var c = cov.static;
    if (ns.currentTestId) {
      c = cov.perTest[ns.currentTestId] = cov.perTest[ns.currentTestId] || {};
    }
    var a = arguments;
    for (var i = 0; i < a.length; i++) {
      c[a[i]] = (c[a[i]] || 0) + 1;
    }
  }
  stryCov_9fa48 = cover;
  cover.apply(null, arguments);
}
function stryMutAct_9fa48(id) {
  var ns = stryNS_9fa48();
  function isActive(id) {
    if (ns.activeMutant === id) {
      if (ns.hitCount !== void 0 && ++ns.hitCount > ns.hitLimit) {
        throw new Error('Stryker: Hit count limit reached (' + ns.hitCount + ')');
      }
      return true;
    }
    return false;
  }
  stryMutAct_9fa48 = isActive;
  return isActive(id);
}
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
  if (stryMutAct_9fa48("0")) {
    {}
  } else {
    stryCov_9fa48("0");
    stryMutAct_9fa48("1") ? loaded &&= import(new URL("../web/server/entry.mjs", import.meta.url).href).then((built: {
      handler: Handler;
    }) => built.handler) : (stryCov_9fa48("1"), loaded ??= import(new URL(stryMutAct_9fa48("2") ? "" : (stryCov_9fa48("2"), "../web/server/entry.mjs"), import.meta.url).href).then(stryMutAct_9fa48("3") ? () => undefined : (stryCov_9fa48("3"), (built: {
      handler: Handler;
    }) => built.handler)));
    return loaded;
  }
};

/** Answers the request with the template of its path, which reads `page`, and this status. */
export async function render(request: FastifyRequest, reply: FastifyReply, status: number, page: unknown): Promise<void> {
  if (stryMutAct_9fa48("4")) {
    {}
  } else {
    stryCov_9fa48("4");
    const astro = await handler();
    if (stryMutAct_9fa48("5")) {
      ;
    } else {
      stryCov_9fa48("5");
      reply.hijack();
    }
    await astro(request.raw, reply.raw, undefined, stryMutAct_9fa48("6") ? {} : (stryCov_9fa48("6"), {
      page,
      status,
      statusText: stryMutAct_9fa48("7") ? STATUS_CODES[status] && "" : (stryCov_9fa48("7"), STATUS_CODES[status] ?? (stryMutAct_9fa48("8") ? "Stryker was here!" : (stryCov_9fa48("8"), "")))
    }));
  }
}