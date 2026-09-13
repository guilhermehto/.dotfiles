---
name: write-code
description: Apply minimal-comment and behaviour-focused testing guidance when writing, fixing, or refactoring code and tests. Use for implementation work, not prose-only tasks.
---

# Write code

## Layout and control flow

- Use blank lines to separate logical phases within a function: setup, requests, validation, transformation, output, and return. Separate setup from a following `try` or loop, and separate completed control-flow blocks from the next distinct step.
- Keep tightly related statements together, such as a value and its immediate validation or a group of related log calls. Do not insert blank lines mechanically between every statement.
- Write conditional statements as multiline blocks, using braces in languages that support them, even for a single statement. Do not write one-line `if` statements, including guard clauses, throws, returns, and conditional logging. Use the language's normal block syntax where braces do not apply.
- Apply these standards to pipeline scripts, small utilities, and other code outside lint or formatter coverage. Run configured tooling where available, then inspect logical grouping and control-flow readability yourself; formatter output alone is not sufficient.

## Comments

- Do not add comments unless absolutely necessary. Prefer clear names and straightforward code.
- Comment only when essential intent, constraints, or non-obvious reasons cannot be expressed clearly in code. Explain why, not what the code does.
- Keep required legal notices, tooling directives, and documentation required by the project. Preserve useful existing comments; update them when the change makes them inaccurate.

## Tests

- Prefer testing observable behaviour through the relevant public interface: given inputs or conditions, assert outputs, errors, or externally visible effects.
- Name tests after behaviour, such as `rejects expired tokens`.
- Avoid assertions about private state, helper calls, or call order unless those interactions are themselves part of the contract. Tests should survive refactors that preserve behaviour.
- Use real logic where practical; mock external boundaries when needed for reliable tests. Do not mock the behaviour being tested.
- For bug fixes, add a regression test that fails before the fix and passes afterward. Cover meaningful edge cases introduced by the change, using the project's existing test conventions.
