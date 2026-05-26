---
description: Render a self-contained explanatory HTML file at <CWD>/explain.html
argument-hint: "[topic or context to explain — defaults to the most recent topic in the chat]"
---

Load the `to-html` skill before doing anything else. It defines the contract for the generated file (self-contained, theme-adaptive, inline JS allowed, silent overwrite) and the output shape.

Arguments: $ARGUMENTS

Steps:

1. Determine the topic:
   - If `$ARGUMENTS` is non-empty, treat it as the topic/context to explain.
   - If empty, use the most recently discussed topic in the current chat.
2. Resolve the target path: `<CWD>/explain.html` (absolute path).
3. If CWD is not writable, abort with a one-line error stating the resolved path. Do not fall back to `/tmp` or anywhere else.
4. Generate the HTML per the `to-html` skill — self-contained, OS-theme-adaptive via `prefers-color-scheme`, inline JS allowed for light interactivity, hand-rolled inline SVG for any diagrams.
5. Write the file, silently overwriting any existing `explain.html`.
6. End the reply with the absolute `file://<path>` URI on its own line. Optionally precede it with a one-line summary of what was rendered.

Rules:

- Never modify `.gitignore`. Never delete other files. Never commit.
- Single output artifact: `<CWD>/explain.html`. No extras (no companion CSS, no images on disk, no helper files).
- No CDN, no network resources, no external fonts — see the skill for the full ban list.
