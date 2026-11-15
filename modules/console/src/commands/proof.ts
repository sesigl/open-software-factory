// The person proof (ADR 0151): with CONSOLE_SIGNING_KEY the console signs each call it makes in a person's name to
// foreman, intake and gatekeeper, in the header OSF-Person, and publishes its keys at /.well-known/jwks.json.
import { UsageError } from "@opensoftware/cli";
import type { PersonKeys } from "@opensoftware/contracts";
import { PERSON_HEADER, personSigner } from "@opensoftware/person-proof";
import type { Role } from "../adapters/access.ts";
import type { Prove } from "../adapters/apis.ts";

export interface Signer {
  /** The key set to publish. */
  keys: PersonKeys;
  /** The proof of the person for one module, over each call's method, path and body. */
  prove(person: { id: string; name?: string; role: Role }, audience: string): Prove;
}

/** The signer of CONSOLE_SIGNING_KEY on the console's clock; a malformed key stops the console. */
export async function signerOf(setting: string, now: () => number): Promise<Signer> {
  const signer = await personSigner(setting, { now: () => new Date(now()) }).catch((failure: Error) => {
    throw new UsageError(`CONSOLE_SIGNING_KEY: ${failure.message}`);
  });
  return {
    keys: signer.keys,
    prove: (person, audience) => async (call) => ({
      [PERSON_HEADER]: await signer.prove({
        person: person.id,
        name: person.name,
        role: person.role,
        audience,
        ...call,
      }),
    }),
  };
}
