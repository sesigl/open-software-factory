---
description: The agent added tests that prove nothing new.
pass: Every test the agent added or changed proves a behavior that no other test already proves.
sample: 0.2
---
Read the session and find every test the agent wrote or changed: files under test folders, files named like
`*.test.*` or `*_test.*`, and test cases added to existing files.

Fail the run when at least one of these is true:

- A new test repeats the inputs and the expected result of another test, with only names or values changed.
- A new test checks only what the type system or the framework already guarantees.
- A new test asserts on a value the test itself created, so it cannot fail.
- The agent added a unit test next to a system test that already covers the same behavior, where the project's
  rules ask for system tests only.

Pass the run when the agent added no tests, or when each new test can fail for a reason no other test covers.
Name the test in your reason when the run fails.
