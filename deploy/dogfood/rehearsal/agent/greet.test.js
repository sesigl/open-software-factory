import assert from "node:assert/strict";
import { test } from "node:test";
import { greet } from "./greet.js";

test("SCN-GREET-001 greet says hello to Ada", () => assert.equal(greet("Ada"), "Hello, Ada!"));
