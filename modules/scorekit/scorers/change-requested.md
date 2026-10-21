---
description: A person had to ask for changes after the agent said it was done.
pass: The agent's first "done" stands; no person asks for a change to the delivered work afterwards.
sample: 0.5
---
Read the session in order. Find the first point where the agent says the work is done, ready or delivered, or
opens a pull request.

Fail the run when, after that point, a person (a user message, or a review comment the agent reads) asks for a
change to the delivered work: a bug, a missed requirement, a wrong file, style the project asked for, or a
failing check the agent should have run.

Pass the run when no person asks for a change afterwards, when the person only asks a question, or when the person
asks for new work that was not part of the first request.

Quote the person's request in your reason when the run fails.
