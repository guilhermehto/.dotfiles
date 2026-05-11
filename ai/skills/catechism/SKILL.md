---
name: catechism
description: Structured clarifying interview to align on intent before non-trivial work. Load when handling /catechism, or whenever a request is vague, multi-interpretable, has unclear scope, would touch many files, involves design tradeoffs, or before exploration/implementation tasks where wrong assumptions would cost real work. Encodes the five dimensions to probe (goal & success criteria, scope & non-goals, constraints, edge cases & failure modes, assumptions to surface), question-crafting rules, batching and pacing, the alignment recap, and the mid-task pause-and-ask pattern.
---

# catechism

A protocol for asking the user the questions only the user can answer, before acting on their behalf. The point is not to be thorough for thoroughness's sake — it's to surface the cheap-to-ask things that are expensive to discover later.

## Core principle

Alignment before action. Ask the questions only the human can answer. Surface assumptions before they harden into code or files.

Corollary: do not ask what you can verify yourself by reading the codebase, running a command, or following a link the user already provided. Cheap research first, questions second.

## When to invoke

Invoke this skill in any of these situations:

- **Explicit**: the user runs `/catechism` or asks you to "clarify", "ask questions first", "make sure we're aligned", or similar.
- **Vague verbs**: "improve", "clean up", "fix", "refactor", "optimize", "make better" without a concrete target or success criterion.
- **Underspecified nouns**: "the app", "the system", "the tests", "the flow" when multiple candidates plausibly match.
- **Multi-interpretable scope**: a request that has two or more reasonable readings (e.g., "add auth" — to which surface? what kind?).
- **Design tradeoffs**: requests where the answer depends on values you don't have (latency vs cost, simplicity vs flexibility, batch vs stream).
- **Broad blast radius**: work likely to touch many files, change public APIs, or introduce a new dependency/pattern.
- **Pre-exploration / pre-plan**: before kicking off a `/kb-explore`, `/kb-plan`, or a multi-step implementation, when the brief is short.

### When to skip

Do not run the interview for:

- Trivial mechanical tasks (rename a symbol, run a command, format a file).
- Requests where the user has already provided a detailed brief with explicit scope, constraints, and success criteria.
- Iterations on the immediately prior turn where context is fresh and unambiguous.
- Pure information lookups ("what does this function do?", "where is X handled?").

When in doubt, ask one meta-question first: "Quick alignment check before I dive in, or do you want me to go?" Respect the answer.

## The five dimensions

Probe these, in roughly this order. Skip dimensions that are already obviously answered.

1. **Goal & success criteria.** What outcome does the user actually want? How will we know it works? What does "done" look like in observable terms?
2. **Scope & non-goals.** Where are the boundaries? What is tempting but explicitly excluded? What's in this pass vs a later one?
3. **Constraints.** Tech stack, conventions to mirror, performance, deadlines, dependencies, things-not-to-touch, environment.
4. **Edge cases & failure modes.** Empty/missing inputs, errors, very large inputs, concurrency, offline, permissions, partial failure, rollback.
5. **Assumptions to surface.** The things you are about to take for granted. State each one and ask the user to confirm, correct, or rank by importance.

Goal and scope come first because they cheaply rule out whole branches of work. Edge cases and assumptions usually emerge after the first two rounds.

## Question protocol

**Every question uses `mcp_Question` with multiple-choice options.** This is the default and the rule, not a preference. The tool already provides a "type your own" escape hatch, so multiple-choice never costs the user expressiveness — it only forces you to enumerate the realistic answer space, which lowers their reply cost and surfaces options they hadn't considered.

If you catch yourself about to ask a free-form question, stop and enumerate 3-5 plausible answers first. "The user might want something I haven't listed" is not a reason to skip enumeration — that is exactly what "type your own" is for. List your best guesses and let the escape hatch handle the long tail.

### When free-form is allowed

Free-form prose is the narrow exception. Use it only when one of these is strictly true, and never out of laziness or because options feel hard to draft:

- The answer is intrinsically open string content with no meaningful buckets: a name, identifier, URL, file path, free-text description, or arbitrary value.
- You attempted to enumerate options and the realistic answer space genuinely exceeds ~8 distinct, non-overlapping choices.
- The question is a closing "anything I'm missing?" / "ready to go?" prompt at the end of a round or recap.

If none of these apply, the question is multiple-choice. No exceptions for "this one is nuanced" or "I want to leave it open" — nuance lives in the options and the type-your-own escape.

### Question-crafting rules

- One concept per question. If a question contains "and" between two distinct decisions, split it.
- Aim for 3-5 options per question. Fewer than 2 is not multiple-choice; more than 6 means the question is too broad and should be split.
- Every option must be a plausible real answer. No filler. No "Other" — `mcp_Question` already provides "type your own".
- Make options mutually distinct. If two options blur together, merge or rewrite.
- Lead with the user's most likely intent when you have a strong prior, and mark it `(Recommended)`. Do not mark a recommendation when you genuinely don't have one.
- No leading language in the question stem. Recommendations belong on the option, not the question.
- Surface the assumption inside the question when relevant: "I'm about to assume X — keep, change, or drop?"
- Never ask what reading a file would answer. Never ask what running `ls`/`rg`/`git log` would answer.
- Never ask trivial taste questions (variable names, log message wording) unless the user has signalled they care.

## Pacing

Batch by dimension. Aim for 3-6 questions per round; never more than 7. Asking 20 at once is the same failure mode as asking none.

Loop:

1. Pick the next unresolved dimension.
2. Ask its batch via `mcp_Question` (or open-ended if the rules above call for it).
3. Read the answers. If new ambiguity appeared, queue follow-ups for the next round.
4. When the current dimension is settled, move to the next.
5. After the last dimension, deliver the recap (below) and ask "anything I'm missing?" or "ready for me to go?".

Stop conditions:

- The user confirms the recap or says "go", "ship it", "proceed", or similar.
- The user explicitly cuts the interview short ("just go", "stop asking", "I'll tell you as we go"). Honour it immediately; do not re-prompt.
- You've reached three rounds without converging — pause and ask whether to keep refining or proceed with explicit caveats listed.

## Alignment recap

When the interview ends, produce a compact recap in this shape:

```
Understanding:
- Goal: <one line>
- Success: <observable criterion>
- In scope: <bullets>
- Out of scope: <bullets>
- Constraints: <bullets>
- Edge cases handled: <bullets>
- Open assumptions: <bullets, each one the user implicitly or explicitly confirmed>

Next step: <what I'll do first>.
Reply "go" to proceed, or correct anything above.
```

Rules:

- Keep it terse. The recap is a contract, not an essay.
- Do not start the work until the user replies affirmatively. Silence is not consent.
- If the user corrects the recap, edit it in place and re-confirm — do not start a fresh interview.

## Mid-task pause-and-ask

The interview is not only for the start of a task. Whenever, mid-task, you would otherwise silently make a material assumption — pause and ask one focused question via `mcp_Question` with 2-4 options. The free-form exceptions above apply here too and are equally narrow.

A material assumption is one where guessing wrong would mean throwing away work, breaking something the user cares about, or shipping a different feature than requested. Cosmetic choices (naming, ordering of unrelated bullets) do not qualify.

Format the mid-task ask as a single short question, not a new round. Get the answer, log it briefly in the running context, resume.

## Hard rules

- Never run the interview when the user has explicitly said "just do it" or equivalent.
- Never invent questions to look thorough; every question must change what you do next.
- Never use free-form prose for a question with 3-5 plausible enumerable answers. Enumerate them as `mcp_Question` options and let "type your own" cover the long tail.
- Never bury the user's likely intent inside a generic "Other" or "It depends". Split the question instead.
- Never ask what you can answer by reading the repo.
- Never proceed past the recap without an affirmative go-ahead.
- Never re-ask a question the user already answered in the same session, unless their later answer contradicted it (in which case, surface the contradiction).
