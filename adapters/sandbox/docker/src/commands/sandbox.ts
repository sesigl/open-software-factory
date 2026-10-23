// @ts-nocheck
// What every command needs: a sandbox that exists, found by its ID.
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
import { check } from "@opensoftware/cli";
import { docker } from "../adapters/docker.ts";
import { ID, sandboxName } from "../domain/names.ts";

/** The container of the sandbox; an ID of the wrong form is a usage error, an unknown one an error. */
export async function sandboxContainer(id: string | undefined): Promise<string> {
  if (stryMutAct_9fa48("334")) {
    {}
  } else {
    stryCov_9fa48("334");
    check(stryMutAct_9fa48("338") ? id || ID.test(id) : stryMutAct_9fa48("337") ? false : stryMutAct_9fa48("336") ? true : (stryCov_9fa48("336", "337", "338"), id && ID.test(id)), stryMutAct_9fa48("339") ? "" : (stryCov_9fa48("339"), "name a sandbox by the 12 hex digits create printed"));
    const name = sandboxName(id as string);
    const found = await docker(stryMutAct_9fa48("340") ? [] : (stryCov_9fa48("340"), [stryMutAct_9fa48("341") ? "" : (stryCov_9fa48("341"), "container"), stryMutAct_9fa48("342") ? "" : (stryCov_9fa48("342"), "inspect"), stryMutAct_9fa48("343") ? "" : (stryCov_9fa48("343"), "--format"), stryMutAct_9fa48("344") ? "" : (stryCov_9fa48("344"), "{{.Name}}"), name]));
    if (stryMutAct_9fa48("347") ? found.code === 0 : stryMutAct_9fa48("346") ? false : stryMutAct_9fa48("345") ? true : (stryCov_9fa48("345", "346", "347"), found.code !== 0)) throw new Error(stryMutAct_9fa48("349") ? `` : (stryCov_9fa48("349"), `no sandbox ${id}`));
    return name;
  }
}