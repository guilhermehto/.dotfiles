---
name: live-html
description: Serve a markdown file as a live, annotatable HTML page and run an annotate → act → reflect loop with the user. The user selects text in the browser, attaches comments, approves the ones to act on, and sends them; the agent reads the approved comments, edits the markdown, and the page auto-reloads. Load when the user says /live-html, asks to "annotate this doc/markdown", "render this markdown so I can comment on it", "start the annotation server", "review this doc live", or types "go" after annotations were sent. A lightweight plannotator — markdown only for now.
---

# live-html

Turn a markdown file into a browser page the user can highlight and comment on, then act on the approved comments and let the page live-update. One local Node server (core modules only, no deps), one HTML client, one sidecar JSON file.

## The loop

1. **Serve** — start the server on the target `.md`; a browser tab opens.
2. **Annotate** — user selects text, writes comments, checks the ones to *approve*, clicks **Send approved**.
3. **Collect** — server writes approved comments to `<dir-of-md>/.annotator/annotations.json`.
4. **Act** — user types **"go"** in chat; agent reads the sidecar, edits the `.md`, clears the sidecar.
5. **Reflect** — the server sees the file change and auto-reloads the tab (SSE). Comments are gone — fresh page, next round.

Comments are **consumed and cleared each round** — no re-anchoring across edits (v1).

## Starting the server

Resolve the target markdown file first:
- User named a path → use it.
- Otherwise look in CWD: exactly one `.md` → use it; zero or many → ask which one.

Launch it in the **background** so it survives across turns (assets live in this skill dir):

```
node <skill-dir>/server.js <abs-path-to.md> [port]
```

Default port is `8765`. The server prints the serve URL and the annotations file path, and runs `open` on the URL (macOS). Tell the user the tab is open and they can start annotating. Note the pid so it can be stopped later (`kill <pid>`).

`<skill-dir>` is the directory this `SKILL.md` lives in. Use its absolute path.

## Auto-apply (armed mode)

To drop the manual "go", **arm the watcher** right after starting the server, in the **background**:

```
node <skill-dir>/watch.js <dir-of-md>/.annotator/annotations.json
```

It blocks until the sidecar holds pending (non-empty) comments, then exits — which wakes the agent. On that wake:

1. Apply the annotations (see below).
2. Clear the sidecar.
3. **Re-arm** by launching `watch.js` in the background again.

The clear happens *before* re-arming, so the agent's own empty write never self-triggers. A running interactive session can't be pushed to from outside — this background-task wake is the supported way to remove "go" while staying in this session. The user can still type "go" manually; to disarm, stop the background watch task.

## Acting on annotations ("go")

When the user says **go** (or re-invokes the skill to apply comments), read:

```
<dir-of-md>/.annotator/annotations.json
```

Schema:

```json
{
  "doc": "/abs/path/to/file.md",
  "sentAt": "<iso timestamp>",
  "comments": [
    { "quote": "exact text the user highlighted",
      "comment": "what the user wants done there",
      "heading": "nearest preceding heading",
      "context": "text of the containing block (locator hint)" }
  ]
}
```

For each comment: locate the spot in the `.md` using `quote` (best-effort — the highlighted text may differ slightly from the raw markdown because of inline syntax like `**`, `` ` ``, or links; use `heading` and `context` to disambiguate), then apply the requested change by editing the file. Treat `comment` as the instruction, anchored at `quote`.

After applying everything, **empty the sidecar** so the same comments aren't re-applied next round:

```json
{ "doc": "...", "sentAt": "...", "comments": [] }
```

The server's file watcher then auto-reloads the browser to show the edited doc. No need to restart anything or tell the user to refresh.

If `comments` is empty, there's nothing to do — say so.

## Notes & ceilings

- **Markdown subset renderer** (client-side): headings, lists, code spans/fences, blockquotes, hr, links, `**bold**`/`*italic*`/`~~strike~~`. No tables, nested lists, or reference links. Docs render close enough to annotate; swap in a real parser if richer fidelity is needed.
- **Highlight** uses `Range.extractContents` — works across inline nodes; a rare multi-block selection keeps the comment but skips the visual highlight.
- **Watcher** watches the parent dir and filters by filename (survives atomic-save renames).
- **Scope:** markdown only. No diff view, no persistent comment threads (both deferred).
- **Server lifecycle:** auto-exits ~5s after the last browser tab closes (SSE disconnect; a refresh survives the grace window), and after 5 min if no tab ever connects — so it won't orphan. One server per doc/port; `kill <pid>` still stops it early. The background watcher is separate (tied to the chat session).
- **Sandbox:** binding localhost is blocked by the command sandbox, so the launch will need it disabled (a one-time prompt), or the user can start it themselves with `! node <skill-dir>/server.js <file.md>`.
