---
name: live-html
description: Serve a markdown file as a live, annotatable HTML page and run an annotate → act → reflect loop with the user. The user selects text in the browser (or adds a general comment), writes what should change, approves the comments to act on, and sends them; the agent is woken with the approved comments, edits the markdown, and the page re-renders in place with the changed blocks marked. Load when the user says /live-html, asks to "annotate this doc/markdown", "render this markdown so I can comment on it", "start the annotation server", "review this doc live", or types "go" after annotations were sent. A lightweight plannotator — markdown only for now.
---

# live-html

Turn a markdown file into a browser page the user can highlight and comment on, apply the approved comments to the file, and let the page update live. Node core modules only — nothing to install.

`<skill-dir>` is the directory this `SKILL.md` lives in; always use its absolute path.

| File | Role |
|---|---|
| `server.js` | local server for one doc: page, SSE live updates, receives Sends |
| `watch.js` | hands you the next batch of approved comments, then exits |
| `state.js` | on-disk batch store shared by both |
| `markdown.js`, `client.html`, `client.js` | renderer and page UI |
| `test/` | `node --test "<skill-dir>/test/*.test.js"` (server tests need local port binding) |

## The loop

1. **Serve** — start `server.js` and `watch.js` in the background; a tab opens.
2. **Annotate** — the user selects text → **Comment** (or presses `C`; **＋ General comment** covers the whole doc), types the instruction, approves it (⏎ or **Approve**), then **Send** (⌘⏎). Unapproved drafts stay on the page and survive reloads and doc edits; Esc discards an empty one.
3. **Wake** — `watch.js` claims the batch, prints it as JSON, and exits; the exit wakes you. The page shows "Agent is applying".
4. **Act** — edit the markdown per comment.
5. **Reflect** — re-arm `watch.js`. Starting it marks the batch applied ("✓ Agent applied N comments"). The page has already re-rendered in place, with changed blocks marked in the gutter and a **Next ↓** link.

## Starting

Resolve the target file:
- User named a path → use it.
- User wants a new document → draft it first (ask for topic, audience, or outline only if you can't infer them), write the file, then serve it. The server needs an existing file.
- Otherwise look in CWD: exactly one `.md` → use it; zero or many → ask which one.

Launch both in the **background** (same absolute `.md` path for both):

```
node <skill-dir>/server.js <abs-path-to.md> [port]
node <skill-dir>/watch.js <abs-path-to.md>
```

Give the user the URL from the server output (`live-html serving <name> at http://127.0.0.1:<port>/`) and say they can start annotating.

- Binds `127.0.0.1` only. Default port 8765; if taken, tries the next free one up to 8784.
- Starting it again for a doc that already has a live server just re-opens that tab and exits 0.
- Opens the tab itself (macOS `open`, Linux `xdg-open`); `LIVE_HTML_NO_OPEN=1` disables that.
- Exits 30s after the last tab closes, or after 5 min if no tab ever connects. `kill <pid>` stops it early.
- **Sandbox:** the command sandbox blocks both binding a port and `open`, so run the **server** command with the sandbox disabled, or ask the user to run `! node <skill-dir>/server.js <abs-path-to.md>`. `watch.js` works sandboxed as long as the doc's directory is writable.

## On wake

`watch.js` prints:

```json
{
  "doc": "/abs/path/to/file.md",
  "serverStopped": false,
  "comments": [
    {
      "quote": "exact text the user highlighted (empty for a general comment)",
      "comment": "what the user wants done",
      "heading": "nearest heading above the quote",
      "lines": [12, 14],
      "source": "raw markdown of lines 12-14 when the comment was sent"
    }
  ]
}
```

1. **`serverStopped: true`** → the user closed the tab and the server exited. Say so and don't re-arm; restart only if asked.
2. **Apply each comment:**
   - Locate it with `source` (raw markdown, so it can be used directly to find the edit target) and `lines`. `quote` is *rendered* text, so inline markup (`**`, backticks, link syntax) is missing from it. If the file changed after sending, line numbers may have shifted; trust `source`/`quote` over `lines`.
   - Empty `quote` and `lines: null` → the instruction applies to the whole document.
   - Treat `comment` as the instruction, anchored at `quote`. If it's a question, answer it in chat without editing. If it's ambiguous, ask in chat instead of guessing.
3. **Re-arm:** launch `node <skill-dir>/watch.js <abs-path-to.md>` in the background again, *after* editing — starting it is what marks the batch applied on the page.
4. **Report:** one short line per comment: what changed, or the answer/question.

**Manual mode** (the user types **go**, or the harness can't wake you from a background exit): `node <skill-dir>/watch.js <abs-path-to.md> --once` prints pending comments without waiting. After applying them, run `--once` again to mark them applied. It also prints anything sent in the meantime; act on that too.

## State

`<dir-of-md>/.live-html/<file-name>/` holds one JSON file per Send, moving through `inbox/` (sent) → `claimed/` (handed to you) → `done/` (applied), plus `server.json` for the running server. `.live-html/.gitignore` keeps the whole tree out of git. Batches are never deleted — check `done/` if you need to see what was asked earlier.

## Rendering

`markdown.js` renders the GFM subset docs use:
- ATX and setext headings, with anchor ids
- emphasis, strikethrough, and hard line breaks
- code spans and fenced code
- block quotes and GitHub alerts (`> [!NOTE]`)
- nested, ordered, and task lists
- tables with alignment
- inline, reference, and bare links
- images: relative paths resolve from the doc's directory
- raw HTML
- YAML front matter, shown as a muted block

` ```mermaid ` fences render via jsdelivr when it's reachable; otherwise they stay as source. Not supported: footnotes, indented code blocks, math.

## Notes & ceilings

- **Anchoring:** a comment anchors to rendered text. Drafts re-find their quote after every re-render. If the quoted text was edited away, the card is flagged and sent without `lines`/`source`. Diagram (SVG) text can't be selected; comment on the prose around it or use a general comment.
- **One server per doc.** Docs that share a directory get separate state.
- **Trust boundary:** comments are treated as the user's instructions because only their tab can send them. The server rejects non-local `Host` headers and cross-origin or non-JSON POSTs, and the page CSP blocks scripts in the doc's raw HTML.
