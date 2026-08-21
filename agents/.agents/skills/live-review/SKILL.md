---
name: live-review
description: Render a PR or local git diff as a visual, annotatable review page — narrative summary, annotated per-file diffs, contract callouts, optional architecture diagram, plus a full code review — served by a local server; the user highlights text and asks questions, the agent answers them back into the page. Load when the user says /live-review, "recap this PR", "recap my changes", "visual review of this diff/branch/PR", "overview page I can comment on", "open a review page", or types "go" after sending questions. Works on anything the code-review skill can target, local or remote. Strictly read-only Q&A — never edits the repo.
---

# live-review

Turn a diff — local changes or a remote PR — into a browser page the user can read, highlight, and question. Visual-recap-style overview on top, code-review findings below, Q&A threaded into the page. One local Node server (core modules only, no deps), one HTML client, one sidecar JSON file.

## The loop

1. **Build** — identify the target diff, review it, write `review.json` into a fresh session dir.
2. **Serve** — start the server on the session dir; a browser tab opens.
3. **Ask** — user selects text anywhere on the page, writes questions, clicks **Send**; the server appends them to `qa.json` as `pending`.
4. **Answer** — the armed watcher wakes the agent (or the user types **"go"**); the agent answers each pending question via `POST /answers`.
5. **Reflect** — the server sees `qa.json` change and refreshes the page (SSE); answers appear in the Q&A panel. Next round.

Q&A accumulates for the life of the session. Regenerating the overview (new session dir) starts clean.

## Building the review document

**First, read the sibling code-review skill:** `../code-review/SKILL.md` relative to this skill's directory. Its **Review protocol** section governs three things here — do not restate or approximate them from memory, read them fresh each run so edits to that skill propagate:

- **Target identification**: its table maps user intent (staged, unstaged, branch ranges, commits, PR URLs/numbers) to diff sources and base-resolution rules.
- **How to review**: its intent, coverage, finding-quality, confidence, and conditional-lens guidance produces the findings.
- **Output format**: its canonical markdown structure, including per-finding confidence temperatures, fills the `review` field below.

Its **Hard rules** apply verbatim: read-only, allowed git verbs only, evidence-based attribution to the change, and neutral language. This skill never mutates the repo — comments are questions, not change requests.

**Writing register — caveman-full.** Every prose field you author — `summary`, callout `body`, annotation `note`s, the sentences inside `review`, Q&A answers — is ultra-terse: drop articles, filler, and hedging; fragments OK; short synonyms (fix, not "implement a solution for"); each fact stated once. Technical terms, code, API names, paths, and error strings stay exact; never invent abbreviations (cfg/impl/fn). The code-review output *structure and confidence annotations* stay verbatim — compression applies to sentences inside it, never to its headers, `file:line` citations, confidence temperatures, or code. Drop to plain clear sentences only where compression breeds ambiguity (step ordering, destructive-action warnings), then resume.

- Not: "This change refactors the session handling logic in order to improve the reliability of token refreshes."
- Yes: "Session refresh hardened. TTL 60s to 300s, jitter added. Risk: clients pinned to 60s."

Then assemble the document:

1. Get the per-file breakdown mechanically: `git diff --numstat <range>` + `git diff --name-status <range>` (or the provider equivalents for PRs), then the per-file unified diffs.
2. Pick the **3–8 load-bearing files** (`key: true`) and annotate their important hunks — a few high-signal notes per file, not one per line. Every other changed file is included non-key (collapsed in the page); for a gigantic non-key diff (>~2000 lines) set `diff: ""` rather than bloating the page.
3. Write `summary`: 1–3 short paragraphs, caveman-full — what changed, why, risks.
4. Add `callouts` **only when** the diff touches API contracts, schemas, or migrations. Add `diagram` (mermaid source) **only when** the diff shifts architecture or data flow. Most diffs need neither.
5. Run the review per the protocol and put its markdown output in `review`.
6. Write it all to `<session>/review.json`, where `<session>` is a fresh temp dir: `mktemp -d -t live-review`.

For every local target, delegate production of the `review` markdown to a subagent as required by code-review's routing; document assembly stays with you.

### review.json schema

```json
{
  "title": "Short title, ≤70 chars",
  "target": "feature/x vs main @ abc1234",
  "generatedAt": "2026-07-05T12:00:00Z",
  "summary": "caveman-full markdown narrative",
  "callouts": [
    { "kind": "api", "title": "POST /sessions/refresh added", "body": "markdown" }
  ],
  "diagram": "flowchart LR\n  a --> b",
  "files": [
    {
      "path": "src/auth/session.ts",
      "status": "modified",
      "additions": 42, "deletions": 7,
      "key": true,
      "diff": "@@ -10,6 +10,9 @@\n context\n-old line\n+new line",
      "annotations": [
        { "line": 12, "note": "markdown — anchors to NEW-file line 12" },
        { "line": 10, "side": "old", "note": "anchors to a removed line" }
      ]
    }
  ],
  "review": "## Findings\n… (canonical code-review output format, including confidence temperatures)"
}
```

`callouts`, `diagram`, `annotations`, and `renamedFrom` (on renames) are optional. `status` ∈ `added | modified | removed | renamed`. Diffs are plain unified-diff text; lines before the first `@@` render as muted metadata.

## Serving and arming

Launch both in the **background** so they survive across turns (assets live in this skill dir):

```
node <skill-dir>/server.js <session-dir> [port]     # default port 8766
node <skill-dir>/watch.js <session-dir>/qa.json     # armed watcher — the default
```

`<skill-dir>` is the directory this SKILL.md lives in; use its absolute path. The server prints the URL, opens the tab (macOS `open`), and auto-exits ~5s after the last tab closes or after 5 min if none ever connects. Note the pid (`kill <pid>` stops it early). Port 8766 keeps it clear of live-html's 8765; pick another if taken.

The watcher blocks until `qa.json` holds `pending` entries, then exits — which wakes the agent. Arm it by default right after starting the server. The user can still type **"go"** manually; to disarm, stop the background watch task.

## Answering questions

On wake (watcher exit or "go"), read `<session>/qa.json`:

```json
{ "entries": [ { "id": 1, "quote": "…", "section": "src/auth/session.ts",
  "context": "…", "question": "…", "status": "pending", "askedAt": "…" } ] }
```

For each `pending` entry: locate what the user highlighted (`quote` + `section` — a file path or section name — plus `context` as the containing block), re-read the relevant diff/code as needed, and compose a grounded markdown answer in the caveman-full register above. Cite `file:line` where useful; mark inference as such. Answers only — never edit the repo, never turn a question into a change.

Deliver answers through the server (single writer for `qa.json` — avoids racing a concurrent user send). Write the payload to a file to dodge shell quoting:

```
<session>/answers-payload.json:   { "answers": [ { "id": 1, "answer": "markdown …" } ] }

curl -s -X POST http://localhost:<port>/answers \
  -H 'content-type: application/json' --data-binary @<session>/answers-payload.json
```

The page refreshes itself (SSE) and the Q&A panel shows the answers. Then **re-arm** the watcher. If the server already exited (all tabs closed), edit `qa.json` directly instead: set `answer`, `status: "answered"`, `answeredAt` on each entry.

**Staleness:** the page is a static snapshot of `target` at `generatedAt`. If the repo has moved since (new commits, edited working tree), still answer — against the snapshot — and prefix the first affected answer with a one-line note offering to regenerate the page.

## Notes & ceilings

- **Session-scoped:** everything lives in the temp session dir; nothing is written into the repo. Re-invoking builds a fresh session (past Q&A is not carried over).
- **Static snapshot:** no live re-render when the code changes; regenerate instead.
- **Mermaid via CDN** (jsdelivr, loaded only when a diagram exists); offline the raw source shows in a `<pre>`. Diff and markdown rendering are hand-rolled — same markdown subset as live-html.
- **Answers render in the Q&A panel**, keyed by quote — no inline re-anchoring into the doc (v1).
- **No file-tree or commit-list sections** by design; flat question→answer pairs (a follow-up is a new question).
- **Sandbox:** binding localhost is blocked by the command sandbox, so the launch will need it disabled (a one-time prompt), or the user can start it themselves with `! node <skill-dir>/server.js <session-dir>`.
