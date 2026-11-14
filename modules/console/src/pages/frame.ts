// @ts-nocheck
// The data of the page frame that a template of src/web/ shows (ADR 0132): computed here, so the template only reads it.
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
import type { NamedLink } from "../domain/runs.ts";
import type { Frame } from "./html.ts";
export interface FrameData {
  title: string;
  links: NamedLink[];
  inbox: boolean;
  work: boolean;
  improvement: boolean;
}
export const frameData = stryMutAct_9fa48("23") ? () => undefined : (stryCov_9fa48("23"), (() => {
  const frameData = (frame: Frame): FrameData => stryMutAct_9fa48("24") ? {} : (stryCov_9fa48("24"), {
    title: frame.title,
    links: frame.links,
    inbox: Boolean(frame.inbox),
    work: Boolean(frame.work),
    improvement: Boolean(frame.improvement)
  });
  return frameData;
})());