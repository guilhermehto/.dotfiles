---
name: personal-writing-style
description: Write PR descriptions, PR messages, Slack messages, update comments, and copy-pasteable summaries in Gui's writing style. Use when the user asks to "write a PR message", "write a PR description", "write a Slack message", "draft this update", or similar, especially for recent changes or local diffs.
---

# personal-writing-style

Use this skill to write copy that sounds like Gui: practical, direct, a little candid, and ready to paste into a PR description or Slack thread.

## When to invoke

Invoke this skill when the user asks for any of these:

- "write a PR message"
- "write a PR description"
- "write a Slack message"
- "draft an update"
- "summarise these recent changes"
- "make this sound like me"
- Any similar request where the output is user-facing engineering prose, not code.

If the user says "recent changes", inspect the local diff and recent commits if available. Do not invent context that is not in the diff, prompt, ticket, or linked discussion.

## Voice

Write like this:

- Direct and context-first.
- Practical over polished.
- Comfortable saying what is unknown.
- Specific about what changed and why.
- Low ceremony. No corporate phrasing.
- Slightly conversational, but still useful to teammates.

This style can say:

- "not really sure why this only started breaking now but here we are"
- "I still can’t reproduce this locally"
- "At this stage I just want..."
- "If this breaks something I can make a localised change instead"
- "This fixes staging, but can’t be rolled out to production yet..."

It should not say:

- "I am excited to share"
- "This PR aims to leverage"
- "Please find below"
- "This comprehensive change"
- "Seamlessly"
- "Robustly" unless it is genuinely the right technical word

## Shape for PR descriptions

Prefer this flow:

1. Start with the situation or problem.
2. Mention the relevant uncertainty or constraint if there is one.
3. Say what the PR changes.
4. Mention the risk, limitation, or follow-up when useful.
5. Add links or test evidence only if provided.

Common shapes:

```md
Something changed in <system>, which <good thing>, but broke <thing>.
This fixes <environment/case>, but can’t be rolled out to <other environment/case> yet because <reason>.
I left a comment about it in the code so it’s easier to identify and fix once <condition>.
```

```md
There are <checks/tests/users> failing in <environment> that we can’t reproduce locally. After <step>, <symptom>.

<Affected thing 1>
<Affected thing 2>

This PR:
Adds <diagnostic/change>
Retries <operation> once if <failure condition>
Removes <old workaround> so <normal path remains true>

I’ve also tried <manual repro / verification>, no luck: it works.
```

```md
Follow up from <previous PR/link>, which, opposed to what I said, did not fix the issue.

I still can’t reproduce this locally and one of the hypothesis is that <hypothesis>. I couldn’t find a way to replicate <environment-specific thing> locally.

If this uncovers the root cause we can look for a fix, if not I’ll reach out to <team/person> and see what we can do.
```

## Shape for Slack messages

Slack should be shorter than PR copy unless the user asks for detail.

Prefer this flow:

1. What happened / what changed.
2. Why it matters.
3. What was tried or what is known.
4. What happens next, or the specific ask.

Examples of the shape:

```md
Heads up, <thing> is failing in <environment> but I still can’t reproduce it locally.

What I know so far:
- <fact>
- <fact>
- <fact>

I’m going to <next step>. If anyone has seen <specific symptom> before, please send it my way.
```

```md
I think <cause/hypothesis> might be what is causing <problem>. Not 100% sure yet, but <evidence>.

I’ll try <next step> and report back. If that doesn’t work I’ll reach out to <team/person>.
```

## Style details

- Use first person when Gui did the work: "I changed", "I tried", "I couldn’t reproduce".
- Use "we" when talking about team-owned state or shared next steps.
- Keep contractions: "can’t", "couldn’t", "I’ll", "we’re".
- Prefer simple verbs: "fixes", "adds", "removes", "retries", "changes".
- Keep sentences medium length. A few long sentences are fine if they sound natural.
- Use bullets only when they make the copy easier to scan.
- For `This PR:`, plain line-separated items are okay. Markdown bullets are also okay when there are nested links or evidence.
- Keep links as labels if the user provided labels, for example:
  - Slack thread
  - Docs
- Do not over-explain tests. Mention the useful result or evidence.
- Do not hide uncertainty. If the evidence is incomplete, say that plainly.
- Do not invent certainty, root causes, owners, links, or timelines.
- Do not add a formal title unless the user asks for one.

## Output contract

- Return the message only, unless the user asks for options or explanation.
- Make it copy-pasteable.
- Do not preface with "Here’s a draft" unless there are multiple drafts.
- If context is missing, make the best draft from available facts and use neutral placeholders like `<link>` only when unavoidable.
- If the requested copy depends on local changes, summarize only what the diff or commit history supports.

## Editing supplied drafts

When the user gives a rough draft:

- Preserve their meaning and level of certainty.
- Keep useful awkwardness if it makes the message sound more like them.
- Remove filler, not personality.
- Do not make it sound like release notes unless they asked for release notes.
