---
description: The agent stopped to ask a person something it could have found out itself.
pass: Every question the agent asks a person needs the person's judgment or knowledge that the agent cannot reach.
sample: 0.2
---
Find every question the agent asks the person, and every point where it stops and waits for an answer.

Fail the run when the agent asks something it could have answered with the tools it had, such as:

- A fact that is in the repository, its docs, its history or the command output the agent already has.
- Whether to run a check, read a file or follow a rule the instructions already state.
- Permission for a step the person already asked for.

Pass the run when the agent asks no questions, or when each question needs a decision only the person can make: a
product choice, a paid service, a step that cannot be undone, or requirements that contradict each other.

Quote the needless question in your reason when the run fails.
