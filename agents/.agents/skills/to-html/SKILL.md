---
name: to-html
description: Build a single, self-contained, throwaway HTML file at <CWD>/explain.html to explain a topic visually (inline SVG diagrams, color used semantically, light inline-JS interactivity). Load when handling /to-html, or when the user explicitly asks to "render as HTML", "draw a diagram", "visualize this", "make a diagram of", or similar requests for a browser-openable visual explanation. Do not load this skill to spontaneously enrich ordinary chat explanations — the user must ask.
---

# to-html

A protocol for rendering a single, throwaway HTML file that explains a topic visually — diagrams, color, structure, light interactivity — and opens directly in a browser with no network.

## Core principle

One file, one URI, fully self-contained. The user runs `/to-html`, gets back a `file://` URI, opens it in a browser, and understands the topic better than they would from prose alone. The file exists to be skimmed once and overwritten next time.

## When to invoke

- The user runs `/to-html`.
- The user explicitly asks for a "diagram", "visual", "HTML version", "rendered explanation", "draw this", "visualize", or equivalent.

Do not load this skill to spontaneously enrich ordinary chat answers. Visual files are useful, but the artifact is opt-in.

## The contract

Each invocation MUST:

1. Resolve the target path: `<CWD>/explain.html` (absolute).
2. If CWD is not writable, error out with the resolved path and stop. Do not fall back to `/tmp` or elsewhere.
3. Generate one self-contained HTML5 document (see hard rules below).
4. Silently overwrite any existing `explain.html` in CWD.
5. End the chat reply with the absolute `file://` URI to the file on its own line.

Do NOT write extra files, modify `.gitignore`, delete anything else, or commit.

## Hard rules

- **Self-contained.** No `<link rel="stylesheet" href="https://...">`, no `<script src="https://...">`, no `<img src="https://...">`, no `@import url(...)`, no web fonts from network, no analytics, no telemetry, no trackers.
- **Inline only.** CSS in `<style>`. Images as inline SVG or small base64 data URIs (avoid heavy binary embeds — prefer hand-rolled SVG).
- **JS allowed, minimal and inline.** Use `<script>` for collapsibles, tabs, copy-to-clipboard, simple state toggles. No frameworks, no module imports, no `fetch`/`XMLHttpRequest`.
- **Theme adapts to OS** via `@media (prefers-color-scheme: dark)`. The file looks right in both modes from the same source.
- **Accessible defaults.** Real heading hierarchy (`<h1>` → `<h2>` → ...), semantic landmarks (`<main>`, `<section>`), `<title>` inside meaningful SVGs (and `role="img"` + `aria-labelledby` on the SVG element), interactive elements are real `<button>` or `<details>`.
- **Absolute path for the URI.** Resolve CWD to absolute before emitting `file://`.

## Suggested document shape

Use this as a starting skeleton; adapt the body per topic. The exact structure is not load-bearing — the principles (self-contained, semantic, adaptive theme, visual-first) are.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><!-- short topic title --></title>
  <style>
    :root {
      --bg: #ffffff;
      --fg: #1a1a1a;
      --muted: #5a5a5a;
      --accent: #0b66e4;
      --accent-2: #d63384;
      --surface: #f5f5f7;
      --border: #e1e1e6;
      --code-bg: #f0f0f3;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0f1115;
        --fg: #e8e8ec;
        --muted: #9aa0aa;
        --accent: #6aa8ff;
        --accent-2: #ff7aa8;
        --surface: #1a1d24;
        --border: #2a2e38;
        --code-bg: #161922;
      }
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: var(--bg); color: var(--fg); }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.55;
      max-width: 920px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem 4rem;
    }
    h1, h2, h3 { line-height: 1.25; }
    h1 { font-size: 1.9rem; margin: 0 0 0.5rem; }
    h2 { font-size: 1.35rem; margin: 2rem 0 0.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.3rem; }
    h3 { font-size: 1.1rem; margin: 1.5rem 0 0.4rem; color: var(--muted); }
    p, li { font-size: 1rem; }
    code {
      background: var(--code-bg);
      padding: 0.1em 0.35em;
      border-radius: 4px;
      font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      font-size: 0.92em;
    }
    pre { background: var(--code-bg); padding: 1rem; border-radius: 8px; overflow-x: auto; }
    pre code { background: transparent; padding: 0; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 1rem 1.25rem; margin: 1rem 0; }
    .grid { display: grid; gap: 1rem; }
    .grid.cols-2 { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
    .muted { color: var(--muted); }
    .accent { color: var(--accent); }
    .accent-2 { color: var(--accent-2); }
    figure { margin: 1.5rem 0; }
    figcaption { color: var(--muted); font-size: 0.9rem; margin-top: 0.4rem; text-align: center; }
    svg { max-width: 100%; height: auto; display: block; margin: 0 auto; }
    details {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.5rem 0.9rem;
      margin: 0.6rem 0;
    }
    details > summary { cursor: pointer; font-weight: 600; }
    .tldr {
      border-left: 4px solid var(--accent);
      background: var(--surface);
      padding: 0.75rem 1rem;
      border-radius: 0 8px 8px 0;
      margin: 1rem 0;
    }
  </style>
</head>
<body>
  <main>
    <h1><!-- topic --></h1>
    <p class="muted"><!-- one-line framing --></p>

    <div class="tldr">
      <strong>TL;DR.</strong> <!-- 1-2 sentences -->
    </div>

    <h2>Diagram</h2>
    <figure>
      <svg viewBox="0 0 800 400" role="img" aria-labelledby="diagTitle">
        <title id="diagTitle"><!-- accessible description --></title>
        <!-- inline diagram here -->
      </svg>
      <figcaption><!-- caption --></figcaption>
    </figure>

    <h2>Walkthrough</h2>
    <!-- numbered steps, comparison cards, collapsibles, code blocks, etc. -->
  </main>
</body>
</html>
```

## Visual guidance

- **Diagrams**: hand-rolled inline SVG. Boxes, arrows, labels. Use `<text>` for labels. Diagram-internal palette can use plain hex (CSS vars are awkward inside SVG without extra wiring); pick 2-3 colors that work in both light and dark.
- **Color used semantically.** Reserve `--accent` for the thing being highlighted; `--accent-2` for a contrast or opposing concept. Don't decorate — every color should mean something.
- **Comparison / before-after**: `.grid.cols-2` with two `.card` blocks.
- **Step-by-step**: ordered list, or a sequence of cards with numbered headers.
- **Optional detail**: `<details><summary>...</summary>...</details>` for "click to expand" depth.
- **Tabs / state toggles**: a tiny inline `<script>` with `addEventListener('click', ...)` is fine. No framework. Keep it under ~30 lines.
- **Code samples**: `<pre><code>` blocks. No syntax-highlight library (would need network or a large inline bundle). If color helps, wrap tokens in `<span class="accent">` etc. by hand.
- **Math / equations**: write them in plain HTML with `<sup>`, `<sub>`, Unicode (≈, ≤, ∑). No MathJax.

## Output

After writing the file, end the reply with the absolute `file://` URI on its own line, e.g.:

```
file:///Users/goliveira/some/dir/explain.html
```

Optionally precede it with a single-line summary of what was rendered (e.g. "Rendered: sequence diagram of the auth flow + step-by-step walkthrough."). The URI line must be last so it is trivial to copy.
