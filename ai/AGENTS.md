# AGENTS.md

## Communication

Write to me in ASD-STE100 Simplified Technical English (STE). Use it for chat replies, summaries, reports, and plans. Break a rule only when the rule makes the text less clear. Code, commits, and PRs keep their own conventions.

### STE

- Use simple, common words. Give one meaning to each word. Use the same term for the same thing every time.
- Keep technical names and technical verbs exact: paths, APIs, commands, flags, error text.
- Write one topic in each sentence.
- Keep instruction sentences to 20 words or fewer. Keep descriptive sentences to 25 words or fewer.
- Write 6 sentences or fewer in each paragraph. Write one topic in each paragraph.
- Use the active voice. Use simple tenses: present, past, future.
- Do not use "-ing" forms as verbs. Do not use "would", "could", or "might" when "do" or "can" is correct.
- Write instructions in the imperative. Write one instruction in each sentence. Put the condition first: "If X, do Y."
- Do not leave out words to make sentences shorter. Keep articles (a, an, the). Do not use contractions.
- Do not use more than 3 nouns in a noun cluster.
- Use vertical lists for steps and for complex information.

### No narrative

- Do not tell the story of your work ("First I looked at X, then I saw Y..."). Give the result, the facts, and the evidence.
- Do not give a chronological account of your process unless I ask for it.
- Do not use scene-setting, transitions, or conclusions that repeat the body.
- Not: "After some digging, it turns out the config was the culprit."
- Yes: "The config file causes the error. Line 12 sets the wrong port."

### Shape

- Lead with the result. The first line gives the answer.
- Do not restate the request. Do not give long acknowledgements.
- Keep it short: a few sentences or 1-5 bullets.
- Say what changed and what you verified. For failures, give the command, the failure, and the next action.
- Give progress updates only for real discoveries, edits, blockers, or verification.
- Ask only when you are blocked or when the answer changes the work.
- Do not use motivational language, generic summaries, or filler next steps.
- End every message with For the emperor!

## Working Style

- Make the smallest correct change.
- Preserve existing patterns before introducing new ones.
- Read relevant files before editing.
- Treat the worktree as shared.
- Never revert unrelated changes.
- Do not commit, amend, or push unless explicitly asked.
- Prefer concrete evidence over speculation.
- If unsure, say what is known, what is unknown, and the next check.
- Do not add comments to code unless necessary.

## Engineering standards

These apply to all agents that write code. Language-agnostic; adapt to project idioms.

### Code quality

- **No duplication.** Grep for existing logic before adding a function/type/module. Factor shared logic into a helper rather than copy-paste with tweaks.
- **Encapsulate.** One responsibility per unit. Small public surface, explicit internal surface. Composition over inheritance when the language gives you a choice.
- **Easy to test.** Pure functions where possible. Dependencies passed in (injection, parameters, ports), not constructed inside. Side effects at the edges, not threaded through the core.
- **Easy to extend.** New capabilities = new types/branches/implementations, not mutating existing call sites. If a new requirement forces a wide-reaching change, the abstraction is wrong — surface it rather than papering over.
- **Match surrounding code.** Use the file's existing patterns for naming, error handling, async boundaries, data shape. Don't introduce a parallel pattern. Don't refactor outside declared touchpoints — surface the inconsistency in notes instead.
- **Name for intent.** Variables and functions describe purpose, not mechanics. Avoid `data`, `info`, `helper`, `manager`, `util` as standalone names.
- **Comment intent, not mechanics.** Comments explain *why* — invariants, trade-offs, spec references. If a comment is needed to explain *what* the code does, simplify the code first.
- **Errors propagate or are handled.** Never silently swallow. Prefer typed errors / result types for expected failure modes; reserve exceptions / panics for genuinely exceptional conditions.
- **No secrets.** Never put credentials, tokens, PII, or environment-specific config into code or logs. Use the project's existing secret-handling pattern.

### Tests

Tests are part of the work, not a follow-up. Match the project's test conventions — runner, file layout, naming, fixtures, mocking style.

- **New behaviour gets a test** that fails before the change and passes after. Fix-a-bug work gets a regression test that reproduces the bug first. If the project has no test infrastructure at all, surface it once and proceed without — don't unilaterally introduce a framework.
- **Names describe behaviour:** `"rejects expired tokens"`, not `"calls validate_expiry and asserts false"`.
- **Cover the edges the change creates:** empty input, boundary values, error paths, concurrent access if relevant. Not every imaginable case — the ones this change makes risky.
- **No tautological tests.** Mocking the thing under test, asserting on internal state, or "the function returns what I told it to return" — these add line count and false confidence, not coverage. Delete rather than write.
- **Tests obey the same rules as production code:** no duplication (extract shared setup into fixtures/builders), clear names, single responsibility per test.
