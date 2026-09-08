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
- **Pre-exploration / pre-plan**: before kicking off `/plan` or a multi-step implementation, when the brief is short.

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

Present questions directly in chat. Never use a question or user-input tool for this interview, including `question`, `mcp_Question`, `request_user_input`, or `request_user_input_async`.

Use numbered questions with lettered options so the user can reply `1A 2B 3F`. Keep question numbers unique and increasing throughout the interview, including follow-ups and mid-task asks. Preserve numbers and option letters when referring back to an unanswered question.

### Presenting multiple-choice questions

- Put the recommended choice first as `A) ... (Recommended)`, with a brief reason. Never put a recommendation under another letter. If there is no defensible recommendation, leave all choices unmarked rather than inventing one.
- Give each option a short label and enough explanation to distinguish the trade-off.
- End each multiple-choice question with a lettered `Other — describe your own` option; accept free-text answers too.
- State when multiple selections are allowed and accept replies such as `2AC` for that question. Otherwise expect one choice per question.
- Tell the user once that compact replies such as `1A 2B` are accepted.

Example (two independent decisions):

```text
1. Should this project use version control?
   A) Yes (Recommended) — Track changes and make rollback easier.
   B) No — Keep this project unversioned.
   C) Other — describe your own.

2. Who is the documentation for?
   A) Maintainers (Recommended) — Focus on setup and ongoing changes.
   B) End users — Focus on usage.
   C) Both — Cover both audiences.
   D) Other — describe your own.

Reply with choices such as 1A 2B, or write your own answers.
```

### Batch only independent questions

Before sending a batch, check every question against the others: could any answer change whether another question is needed, its wording, its options, or its recommendation? If yes, ask the prerequisite first and defer the dependent question until the answer is known. Sharing a dimension does not make questions independent.

For example, do not ask "Will we use version control?" and "Which version control: Git or Mercurial?" together. Ask whether first; only ask which if the user chooses to use version control and the choice is still unresolved. Unrelated questions may share the prerequisite's batch.

Re-evaluate deferred questions after each reply. Drop questions made irrelevant or already answered; construct remaining options from the confirmed answers. Do not present conditional branches as extra questions in the same batch.

### When free-form is allowed

Free-form prose is the narrow exception. Use it only when one of these is strictly true, and never out of laziness or because options feel hard to draft:

- The answer is intrinsically open string content with no meaningful buckets: a name, identifier, URL, file path, free-text description, or arbitrary value.
- You attempted to enumerate options and the realistic answer space genuinely exceeds ~8 distinct, non-overlapping choices.
- The question is a closing "anything I'm missing?" / "ready to go?" prompt at the end of a round or recap.

If none of these apply, the question is multiple-choice. No exceptions for "this one is nuanced" or "I want to leave it open" — nuance lives in the options and the open-ended escape.

### Question-crafting rules

- One concept per question. If a question contains "and" between two distinct decisions, split it.
- Prefer 2-5 substantive options plus the final Other option. Do not pad a binary decision or split a coherent choice merely to meet an option count.
- Every substantive option must be a plausible real answer. No filler.
- Make options mutually distinct. If two options blur together, merge or rewrite.
- No leading language in the question stem. Recommendations belong on the option, not the question.
- Surface the assumption inside the question when relevant: "I'm about to assume X — keep, change, or drop?"
- Never ask what reading a file would answer. Never ask what running `ls`/`rg`/`git log` would answer.
- Never ask trivial taste questions (variable names, log message wording) unless the user has signalled they care.

## Pacing

Use the five dimensions as a coverage guide, not a question quota. Ask 1-4 independent questions per round; one is enough when other decisions depend on it. Independent questions may span dimensions. Do not add questions just to fill a batch.

Loop:

1. Identify unresolved decisions that materially affect the work, starting with goal and scope.
2. Select only questions whose prerequisites are already settled and which cannot change one another's options or relevance.
3. Ask the batch in numbered chat prose, then wait for the user's reply before asking dependent follow-ups.
4. Read compact selections or free text and briefly summarize the decisions. Preserve answered choices. For partial replies, leave omissions unresolved; never treat silence as option A. Clarify only ambiguous or missing answers that still matter, using their existing numbers where applicable.
5. Re-evaluate the remaining decisions and dependencies. If an answer changes an earlier decision, surface the conflict and resolve it before relying on either.
6. Once material uncertainty is resolved, deliver the recap below. Do not force a round for every dimension.

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
- Open assumptions: <unresolved assumptions, clearly marked; write "none" if settled>

Next step: <what I'll do first>.
Reply "go" to proceed, or correct anything above.
```

Rules:

- Keep it terse. The recap is a contract, not an essay.
- Do not start the work until the user replies affirmatively. An earlier explicit "go" or "stop asking" already satisfies this; do not ask again. Silence is not consent.
- If the user corrects the recap, edit it in place and re-confirm — do not start a fresh interview.

## Mid-task pause-and-ask

The interview is not only for the start of a task. Whenever, mid-task, you would otherwise silently make a material assumption — pause and ask one focused multiple-choice question with 2-4 options. The free-form exceptions above apply here too and are equally narrow.

A material assumption is one where guessing wrong would mean throwing away work, breaking something the user cares about, or shipping a different feature than requested. Cosmetic choices (naming, ordering of unrelated bullets) do not qualify.

Format the mid-task ask as a single short question, not a new round. Get the answer, log it briefly in the running context, resume.

## Hard rules

- Never run the interview when the user has explicitly said "just do it" or equivalent.
- Never invent questions to look thorough; every question must change what you do next.
- Never use free-form prose for a question with 3-5 plausible enumerable answers. Enumerate them as multiple-choice options and let the open-ended escape cover the long tail.
- Never bury the user's likely intent inside a generic "Other" or "It depends". Split the question instead.
- Never ask what you can answer by reading the repo.
- Never use question or user-input tools for the interview.
- Never batch a prerequisite with a question whose relevance, wording, options, or recommendation depends on its answer.
- Never proceed past the recap without an affirmative go-ahead, unless the user has already explicitly told you to proceed or stop asking.
- Never re-ask a question the user already answered in the same session, unless their later answer contradicted it (in which case, surface the contradiction).
