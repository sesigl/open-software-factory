// @ts-nocheck
// What the parts of one sandbox are called on the Docker host, and how a sandbox ID looks.

/** The sandbox's ID: the first 12 hex digits of its container's ID, which Docker chose. */function stryNS_9fa48() {
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
export const ID = stryMutAct_9fa48("418") ? /^[^0-9a-f]{12}$/ : stryMutAct_9fa48("417") ? /^[0-9a-f]$/ : stryMutAct_9fa48("416") ? /^[0-9a-f]{12}/ : stryMutAct_9fa48("415") ? /[0-9a-f]{12}$/ : (stryCov_9fa48("415", "416", "417", "418"), /^[0-9a-f]{12}$/);

/** The container of the sandbox, and the internal network it shares with its egress proxy only. */
export const sandboxName = stryMutAct_9fa48("419") ? () => undefined : (stryCov_9fa48("419"), (() => {
  const sandboxName = (id: string): string => stryMutAct_9fa48("420") ? `` : (stryCov_9fa48("420"), `osf-sandbox-${id}`);
  return sandboxName;
})());

/** The iron-proxy container of the sandbox. */
export const egressName = stryMutAct_9fa48("421") ? () => undefined : (stryCov_9fa48("421"), (() => {
  const egressName = (id: string): string => stryMutAct_9fa48("422") ? `` : (stryCov_9fa48("422"), `osf-sandbox-${id}-egress`);
  return egressName;
})());

/** The label on every sandbox container; `list` finds the sandboxes by it. */
export const ROLE_LABEL = stryMutAct_9fa48("423") ? "" : (stryCov_9fa48("423"), "osf.sandbox.role=sandbox");

/** The name the sandbox reaches its egress proxy by, and the proxy's port for HTTP_PROXY and HTTPS_PROXY. */
export const EGRESS_URL = stryMutAct_9fa48("424") ? "" : (stryCov_9fa48("424"), "http://egress:8080");

/** The working folder of every command in the sandbox. */
export const WORKSPACE = stryMutAct_9fa48("425") ? "" : (stryCov_9fa48("425"), "/workspace");

/** Where the sandbox finds the CA of its egress proxy, which terminates TLS. */
export const CA_FILE = stryMutAct_9fa48("426") ? "" : (stryCov_9fa48("426"), "/etc/osf/egress-ca.crt");

/** iron-proxy, pinned by digest (ADR 0054). */
export const EGRESS_IMAGE = stryMutAct_9fa48("427") ? "" : (stryCov_9fa48("427"), "ironsh/iron-proxy:0.54.0@sha256:6d074be2de9188f88d08013788d5500fb4de8557f16c2e5b27af4d8d2cb1e3fb");