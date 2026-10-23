// @ts-nocheck
// list: the IDs of the sandboxes on the Docker host, one per line.
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
import type { Outcome } from "@opensoftware/cli";
import { dockerText } from "../adapters/docker.ts";
import { ROLE_LABEL, sandboxName } from "../domain/names.ts";
export async function list(): Promise<Outcome> {
  if (stryMutAct_9fa48("317")) {
    {}
  } else {
    stryCov_9fa48("317");
    const names = await dockerText(stryMutAct_9fa48("318") ? [] : (stryCov_9fa48("318"), [stryMutAct_9fa48("319") ? "" : (stryCov_9fa48("319"), "ps"), stryMutAct_9fa48("320") ? "" : (stryCov_9fa48("320"), "--all"), stryMutAct_9fa48("321") ? "" : (stryCov_9fa48("321"), "--filter"), stryMutAct_9fa48("322") ? `` : (stryCov_9fa48("322"), `label=${ROLE_LABEL}`), stryMutAct_9fa48("323") ? "" : (stryCov_9fa48("323"), "--format"), stryMutAct_9fa48("324") ? "" : (stryCov_9fa48("324"), "{{.Names}}")]));
    const prefix = sandboxName(stryMutAct_9fa48("325") ? "Stryker was here!" : (stryCov_9fa48("325"), ""));
    return stryMutAct_9fa48("326") ? {} : (stryCov_9fa48("326"), {
      lines: stryMutAct_9fa48("328") ? names.split("\n").map(name => name.slice(prefix.length)).sort() : stryMutAct_9fa48("327") ? names.split("\n").filter(name => name.startsWith(prefix)).map(name => name.slice(prefix.length)) : (stryCov_9fa48("327", "328"), names.split(stryMutAct_9fa48("329") ? "" : (stryCov_9fa48("329"), "\n")).filter(stryMutAct_9fa48("330") ? () => undefined : (stryCov_9fa48("330"), name => stryMutAct_9fa48("331") ? name.endsWith(prefix) : (stryCov_9fa48("331"), name.startsWith(prefix)))).map(stryMutAct_9fa48("332") ? () => undefined : (stryCov_9fa48("332"), name => stryMutAct_9fa48("333") ? name : (stryCov_9fa48("333"), name.slice(prefix.length)))).sort())
    });
  }
}