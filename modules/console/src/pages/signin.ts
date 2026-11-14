// The data of the sign-in page "/signin" (src/web/pages/signin.astro, ADR 0134): the button of the provider, and why a
// person was refused or why nobody can sign in.
import type { Provider } from "../domain/signin.ts";

export interface SignInData {
  /** The label of the provider's button. */
  button: string;
  /** Where the button leads: the start of the sign-in, with the page to come back to. */
  start: string;
  /** Why the sign-in was refused, in plain words; empty when nothing was refused. */
  refusal: string;
  /** Where the access list lives, shown with a refusal. */
  where: string;
}

const BUTTONS: Record<Provider, string> = { oidc: "Sign in", github: "Sign in with GitHub" };

export const signInData = (provider: Provider, next: string, refusal = "", where = ""): SignInData => ({
  button: BUTTONS[provider],
  start: `/signin/start?next=${encodeURIComponent(next)}`,
  refusal,
  where,
});
