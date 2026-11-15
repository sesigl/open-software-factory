// @opensoftware/person-proof: the person who acts, proven to a module (ADR 0151). The issuer signs, a module checks.
export {
  type Actor,
  type CheckerOptions,
  type PersonCheck,
  type PersonChecker,
  type PersonRequest,
  personChecker,
} from "./checker.ts";
export { PERSON_HEADER, SettingError } from "./keys.ts";
export { type PersonCall, type PersonSigner, personSigner, type SignerOptions } from "./signer.ts";
