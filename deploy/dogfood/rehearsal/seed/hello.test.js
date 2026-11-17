import assert from "node:assert/strict";
import { test } from "node:test";
import { hello } from "./hello.js";

test("SCN-HELLO-001 hello greets the world", () => assert.equal(hello(), "Hello, world!"));
