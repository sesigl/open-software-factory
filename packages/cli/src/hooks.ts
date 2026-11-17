// Test hooks (ADR 0166): environment variables that only the system tests set, like OSF_NOW for the clock and
// OSF_SEED for the random source. A module reads them only through testHook, so a process an operator starts with one
// refuses it instead of running on a fixed clock.
import { UsageError } from "./errors.ts";

/** The switch that turns the test hooks on. The testkit sets it to 1 for every module process it starts. */
const SWITCH = "OSF_TEST_HOOKS";

/**
 * The value of the test hook `name` in `env`, or undefined when it is unset or empty. With the hook set and without
 * OSF_TEST_HOOKS=1 it throws a usage error that names the hook, so the command exits 2.
 */
export function testHook(env: Record<string, string | undefined>, name: string): string | undefined {
  const value = env[name];
  if (!value) return undefined;
  if (env[SWITCH] !== "1") {
    throw new UsageError(
      `${name} is a test hook, which works only with ${SWITCH}=1 in the system tests: unset ${name}`,
    );
  }
  return value;
}
