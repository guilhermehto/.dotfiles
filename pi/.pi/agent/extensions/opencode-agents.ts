/**
 * opencode-agents extension
 *
 * Reuses opencode-style agent definitions discovered from (in order, later shadows earlier):
 *   - `~/.pi/agent/agents/*.md`      (global, pi-native)
 *   - `<cwd>/.opencode/agent/*.md`   (opencode project-local)
 *   - `<cwd>/.pi/agents/*.md`        (pi project-local)
 *
 * Frontmatter schema (subset of https://opencode.ai/docs/agents/):
 *   description: string
 *   mode: "primary" | "subagent" | "all"
 *   model: string                          # e.g. "anthropic/claude-sonnet-4-6"
 *   temperature: number                    # forwarded to subprocess via --temperature (if pi supports)
 *   permission:
 *     edit: "allow" | "ask" | "deny"
 *     webfetch: "allow" | "ask" | "deny"
 *     bash:
 *       "pattern*": "allow" | "ask" | "deny"
 *   tools:
 *     <toolName>: true | false             # whitelist/blacklist applied via pi.setActiveTools
 *
 * Body (everything after the closing `---`) becomes additional system prompt.
 *
 * Primary agents:
 *   - Selected at runtime: `shift+tab` cycles, `/agent` picker, `--agent <name>` flag.
 *   - System prompt is extended (`before_agent_start`), tools are filtered, tool calls are gated.
 *   - Selection persists in the session via `pi.appendEntry`.
 *
 * Subagents:
 *   - Dispatched by the primary agent through the `task` tool.
 *   - Executed in a child `pi -p --mode json` process so context is fully isolated.
 *   - Child re-loads this extension and auto-activates the named subagent
 *     (via PI_OPENCODE_AGENT env var) so the subagent's own permissions apply
 *     inside the child too.
 *   - Streaming JSON events drive a per-call widget so the parent TUI shows what
 *     the subagent is doing in real time.
 */

import type {
	ExtensionAPI,
	ExtensionContext,
	ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { spawn } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ───────────────────────────── types ─────────────────────────────

type PermLevel = "allow" | "ask" | "deny";

interface AgentDef {
	name: string;
	path: string;
	body: string;
	description?: string;
	mode: "primary" | "subagent" | "all";
	model?: string;
	temperature?: number;
	permission: {
		edit: PermLevel;
		webfetch: PermLevel;
		bash: Array<{ pattern: string; level: PermLevel }>;
	};
	tools?: Record<string, boolean>;
}

const GLOBAL_AGENTS_DIR = join(homedir(), ".pi", "agent", "agents");
const PROJECT_AGENT_DIRS = [".opencode/agent", ".pi/agents"];
const STATE_TYPE = "opencode-agent-selection";
const SELF_PATH = import.meta?.url
	? new URL(import.meta.url).pathname
	: __filename;

// Tools gated by the high-level permissions.
const EDIT_TOOLS = new Set(["edit", "write"]);
const WEBFETCH_TOOLS = new Set(["fetch_content", "web_search", "get_search_content"]);

// ──────────────────────── frontmatter parsing ─────────────────────

/**
 * Minimal YAML subset tuned to opencode agent frontmatter. Supports:
 *   - top-level `key: value` (string | number | bool, quoted or bare)
 *   - top-level `key:` followed by an indented block (2 spaces) of key/value pairs
 *   - one further level of nesting (`permission.bash:` -> map of pattern -> level)
 *   - `#` comments and blank lines
 */
function parseFrontmatter(text: string): { fm: Record<string, any>; body: string } {
	if (!text.startsWith("---")) return { fm: {}, body: text };
	const end = text.indexOf("\n---", 3);
	if (end < 0) return { fm: {}, body: text };
	const fmText = text.slice(3, end).replace(/^\r?\n/, "");
	const body = text.slice(end + 4).replace(/^\r?\n/, "");

	const lines = fmText.split(/\r?\n/);
	const root: Record<string, any> = {};
	const stack: Array<{ indent: number; obj: Record<string, any> }> = [
		{ indent: -1, obj: root },
	];

	const unquote = (v: string): any => {
		v = v.trim();
		if (!v) return "";
		if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
			return v.slice(1, -1);
		}
		if (v === "true") return true;
		if (v === "false") return false;
		if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
		return v;
	};

	for (const raw of lines) {
		if (!raw.trim() || raw.trim().startsWith("#")) continue;
		const indent = raw.length - raw.trimStart().length;
		const line = raw.slice(indent);
		const colon = line.indexOf(":");
		if (colon < 0) continue;
		const key = unquote(line.slice(0, colon)) as string;
		const valuePart = line.slice(colon + 1);

		// Pop stack until we find the parent at lower indent.
		while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
			stack.pop();
		}
		const parent = stack[stack.length - 1].obj;

		if (valuePart.trim() === "") {
			// New nested object.
			const child: Record<string, any> = {};
			parent[key] = child;
			stack.push({ indent, obj: child });
		} else {
			parent[key] = unquote(valuePart);
		}
	}

	return { fm: root, body };
}

function loadAgents(cwd: string): Map<string, AgentDef> {
	const agents = new Map<string, AgentDef>();
	const dirs = [
		GLOBAL_AGENTS_DIR,
		...PROJECT_AGENT_DIRS.map((p) => join(cwd, p)),
	];
	for (const dir of dirs) loadAgentsFromDir(dir, agents);
	return agents;
}

function loadAgentsFromDir(dir: string, agents: Map<string, AgentDef>): void {
	let entries: string[] = [];
	try {
		entries = readdirSync(dir);
	} catch {
		return;
	}
	for (const entry of entries) {
		if (!entry.endsWith(".md")) continue;
		const full = join(dir, entry);
		try {
			const st = statSync(full);
			if (!st.isFile()) continue;
		} catch {
			continue;
		}
		const name = entry.replace(/\.md$/, "");
		try {
			const raw = readFileSync(full, "utf8");
			const { fm, body } = parseFrontmatter(raw);
			const perm = (fm.permission ?? {}) as Record<string, any>;
			const bashMap = (perm.bash ?? {}) as Record<string, string>;
			const bash = Object.entries(bashMap).map(([pattern, level]) => ({
				pattern,
				level: normLevel(level),
			}));
			// Longest pattern first so we test specific rules before the catch-all.
			bash.sort((a, b) => b.pattern.length - a.pattern.length);

			// Later directories shadow earlier ones for same agent name.
			agents.set(name, {
				name,
				path: full,
				body: body.trim(),
				description: typeof fm.description === "string" ? fm.description : undefined,
				mode: normMode(fm.mode),
				model: typeof fm.model === "string" ? fm.model : undefined,
				temperature: typeof fm.temperature === "number" ? fm.temperature : undefined,
				permission: {
					edit: normLevel(perm.edit, "allow"),
					webfetch: normLevel(perm.webfetch, "allow"),
					bash,
				},
				tools: fm.tools && typeof fm.tools === "object" ? (fm.tools as Record<string, boolean>) : undefined,
			});
		} catch (err) {
			console.error(`opencode-agents: failed to parse ${full}:`, err);
		}
	}
}

function normLevel(v: any, fallback: PermLevel = "ask"): PermLevel {
	if (v === "allow" || v === "ask" || v === "deny") return v;
	return fallback;
}
function normMode(v: any): AgentDef["mode"] {
	if (v === "primary" || v === "subagent" || v === "all") return v;
	return "all";
}

// ──────────────────────── permission helpers ──────────────────────

function globToRegex(pattern: string): RegExp {
	const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
	return new RegExp(`^${escaped}$`);
}

function bashDecision(agent: AgentDef, command: string): PermLevel {
	// Test against the first line; multi-line scripts use the first command for matching.
	const head = command.split(/\r?\n/).find((l) => l.trim()) ?? command;
	for (const rule of agent.permission.bash) {
		if (rule.pattern === "*") continue; // catch-all handled last
		if (globToRegex(rule.pattern).test(head.trim())) return rule.level;
	}
	const fallback = agent.permission.bash.find((r) => r.pattern === "*");
	return fallback ? fallback.level : "allow";
}

// ─────────────────────────── extension ────────────────────────────

const taskParams = Type.Object({
	subagent: Type.String({ description: "Name of the subagent to dispatch (one of the registered opencode subagents)." }),
	prompt: Type.String({ description: "Full task prompt for the subagent. Be explicit; the subagent has no other context." }),
});
type TaskParams = Static<typeof taskParams>;

export default function (pi: ExtensionAPI) {
	let agents = loadAgents(process.cwd());
	let current: AgentDef | undefined;

	// Auto-activation in child processes spawned by the task tool.
	const envAgent = process.env.PI_OPENCODE_AGENT;

	pi.registerFlag("agent", {
		description: "Activate an opencode agent at startup",
		type: "string",
	});

	// ───── helpers ─────

	const primaries = () =>
		[...agents.values()].filter((a) => a.mode === "primary" || a.mode === "all");
	const subagents = () =>
		[...agents.values()].filter((a) => a.mode === "subagent" || a.mode === "all");

	const applyToolFilter = (agent: AgentDef | undefined) => {
		if (!agent || !agent.tools) {
			// Reset to defaults: enable everything pi knows about.
			try {
				const all = pi.getAllTools?.() ?? [];
				pi.setActiveTools?.(all.map((t: any) => t.name));
			} catch {
				/* older pi versions */
			}
			return;
		}
		try {
			const all = (pi.getAllTools?.() ?? []).map((t: any) => t.name) as string[];
			const explicit = agent.tools;
			const enabled = all.filter((name) => {
				if (name in explicit) return explicit[name] !== false;
				return true; // default-on for unspecified
			});
			pi.setActiveTools?.(enabled);
		} catch {
			/* noop */
		}
	};

	const setAgent = (name: string | undefined, ctx?: ExtensionContext, persist = true) => {
		if (!name) {
			current = undefined;
			ctx?.ui.setStatus("opencode-agent", "");
			applyToolFilter(undefined);
			if (persist) pi.appendEntry(STATE_TYPE, { name: null });
			return;
		}
		const agent = agents.get(name);
		if (!agent) {
			ctx?.ui.notify(`Unknown agent: ${name}`, "error");
			return;
		}
		current = agent;
		applyToolFilter(agent);
		ctx?.ui.setStatus("opencode-agent", `󰚩 ${agent.name}`);
		if (persist) pi.appendEntry(STATE_TYPE, { name: agent.name });
	};

	const cyclePrimary = (ctx: ExtensionContext) => {
		const list = primaries();
		if (list.length === 0) {
			ctx.ui.notify("No primary agents found in ~/.pi/agent/agents/", "warn");
			return;
		}
		const idx = current ? list.findIndex((a) => a.name === current!.name) : -1;
		const next = list[(idx + 1) % list.length];
		setAgent(next.name, ctx);
		ctx.ui.notify(`agent: ${next.name}`, "info");
	};

	// ───── lifecycle ─────

	pi.on("session_start", async (_event, ctx) => {
		agents = loadAgents(ctx.cwd);

		// Restore persisted selection, if any.
		let restored: string | undefined;
		for (const entry of ctx.sessionManager.getEntries()) {
			if (entry.type === "custom" && (entry as any).customType === STATE_TYPE) {
				const data = (entry as any).data;
				restored = data?.name ?? undefined;
			}
		}

		const flagAgent = pi.getFlag?.("agent") as string | undefined;
		const initial = envAgent ?? flagAgent ?? restored;
		if (initial) setAgent(initial, ctx, /* persist */ envAgent ? false : true);
	});

	// ───── system prompt injection ─────

	pi.on("before_agent_start", async (event) => {
		if (!current) return;
		const header = `\n\n# Active agent: ${current.name}\n\n${current.body}\n`;
		return { systemPrompt: event.systemPrompt + header };
	});

	// ───── permission gating ─────

	pi.on("tool_call", async (event, ctx) => {
		if (!current) return;
		const name = event.toolName;

		// Edit / write gating.
		if (EDIT_TOOLS.has(name)) {
			const lvl = current.permission.edit;
			if (lvl === "deny") return { block: true, reason: `agent ${current.name} has edit: deny` };
			if (lvl === "ask") {
				const ok = await ctx.ui.confirm("Edit allowed?", `${current.name} wants to ${name}. Proceed?`);
				if (!ok) return { block: true, reason: "user denied edit" };
			}
		}

		// Webfetch gating.
		if (WEBFETCH_TOOLS.has(name)) {
			const lvl = current.permission.webfetch;
			if (lvl === "deny") return { block: true, reason: `agent ${current.name} has webfetch: deny` };
			if (lvl === "ask") {
				const ok = await ctx.ui.confirm("Webfetch allowed?", `${current.name} wants to ${name}. Proceed?`);
				if (!ok) return { block: true, reason: "user denied webfetch" };
			}
		}

		// Bash gating.
		if (name === "bash") {
			const cmd = (event.input as any)?.command ?? "";
			const lvl = bashDecision(current, cmd);
			if (lvl === "deny") return { block: true, reason: `agent ${current.name} denies: ${cmd.slice(0, 80)}` };
			if (lvl === "ask") {
				const ok = await ctx.ui.confirm("Run command?", cmd.slice(0, 400));
				if (!ok) return { block: true, reason: "user denied bash" };
			}
		}
	});

	// ───── /agent command ─────

	pi.registerCommand("agent", {
		description: "Select an opencode-style agent",
		getArgumentCompletions: (prefix) => {
			const items = [...agents.keys()].map((n) => ({ value: n, label: n }));
			const filtered = items.filter((i) => i.value.startsWith(prefix));
			return filtered.length > 0 ? filtered : null;
		},
		handler: async (args, ctx) => {
			const arg = args.trim();
			if (arg === "off" || arg === "none" || arg === "clear") {
				setAgent(undefined, ctx);
				ctx.ui.notify("agent cleared", "info");
				return;
			}
			if (arg) {
				setAgent(arg, ctx);
				return;
			}
			const list = primaries();
			if (list.length === 0) {
				ctx.ui.notify("No primary agents found in ~/.pi/agent/agents/", "warn");
				return;
			}
			const items = list.map((a) => `${a.name}  —  ${(a.description ?? "").slice(0, 80)}`);
			const choice = await ctx.ui.select("Select agent", [...items, "(clear)"]);
			if (!choice) return;
			if (choice === "(clear)") {
				setAgent(undefined, ctx);
				return;
			}
			const pickedName = choice.split("  —")[0]!.trim();
			setAgent(pickedName, ctx);
		},
	});

	pi.registerCommand("agents", {
		description: "List opencode-style agents",
		handler: async (_args, ctx) => {
			const lines = [...agents.values()].map((a) => {
				const origin = a.path.startsWith(GLOBAL_AGENTS_DIR) ? "global" : "project";
				return `${a.name === current?.name ? "● " : "  "}${a.name.padEnd(20)} [${a.mode}] (${origin}) ${a.description ?? ""}`;
			});
			ctx.ui.notify(lines.join("\n") || "no agents", "info");
		},
	});

	// ───── shift+tab cycles primary agents ─────

	// `tab` is autocomplete and `shift+tab` cycles thinking level — both reserved.
	// Using ctrl+shift+a (mnemonic: Agent). Rebind via ~/.pi/agent/keybindings.json.
	pi.registerShortcut("ctrl+shift+a", {
		description: "Cycle primary opencode agents",
		handler: async (ctx) => cyclePrimary(ctx),
	});

	// ───── task tool: dispatch a subagent ─────

	const taskDef: ToolDefinition<TaskParams> = {
		name: "task",
		label: "Task",
		description:
			"Dispatch an opencode subagent in an isolated session to handle a focused task. The subagent has its own context, system prompt, tools, and permissions. Returns the subagent's final response as plain text.",
		promptSnippet:
			"Use `task` to delegate focused work (codebase searches, plan reviews, commits) to a specialised subagent so the parent context stays small.",
		promptGuidelines: [
			"Use `task` when a subagent's specialised description matches the work; check available subagents with /agents.",
			"Each `task` call is isolated: pass everything the subagent needs to know in the prompt — it cannot see the parent conversation.",
			"Prefer parallel `task` calls when several independent sub-investigations are needed.",
		],
		parameters: taskParams,
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const sub = agents.get(params.subagent);
			if (!sub || (sub.mode !== "subagent" && sub.mode !== "all")) {
				return {
					content: [{ type: "text", text: `Unknown subagent: ${params.subagent}. Run /agents to see options.` }],
					isError: true,
					details: {},
				};
			}

			const widgetKey = `task-${toolCallId}`;
			const widgetLines: string[] = [`󰚩 task[${sub.name}] starting…`];
			ctx.ui.setWidget(widgetKey, widgetLines.slice());

			const args: string[] = [
				"-p",
				"--mode", "json",
				"--no-extensions",
				"-e", SELF_PATH,
				"--no-session",
			];
			if (sub.model) args.push("--model", sub.model);
			// Subagent gets its own system prompt = default coding prompt + agent body (we replace).
			args.push("--system-prompt", sub.body);
			args.push(params.prompt);

			const child = spawn("pi", args, {
				stdio: ["ignore", "pipe", "pipe"],
				env: { ...process.env, PI_OPENCODE_AGENT: sub.name },
			});

			signal?.addEventListener("abort", () => child.kill("SIGTERM"));

			const finalTextChunks: string[] = [];
			let buf = "";
			let stderrBuf = "";

			const pushStatus = (line: string) => {
				widgetLines.push(line);
				while (widgetLines.length > 8) widgetLines.shift();
				ctx.ui.setWidget(widgetKey, widgetLines.slice());
				onUpdate?.({ content: [{ type: "text", text: widgetLines.join("\n") }] });
			};

			const handleEvent = (ev: any) => {
				try {
					switch (ev.type) {
						case "turn_start":
							pushStatus(`turn ${ev.turnIndex ?? ""} start`.trim());
							break;
						case "tool_execution_start":
							pushStatus(`→ ${ev.toolName}${describeArgs(ev.toolName, ev.args)}`);
							break;
						case "tool_execution_end":
							pushStatus(`  ${ev.isError ? "✗" : "✓"} ${ev.toolName}`);
							break;
						case "message_end":
							if (ev.message?.role === "assistant") {
								const text = extractText(ev.message);
								if (text) finalTextChunks.push(text);
							}
							break;
					}
				} catch {
					/* ignore malformed events */
				}
			};

			child.stdout.on("data", (chunk: Buffer) => {
				buf += chunk.toString("utf8");
				let nl: number;
				while ((nl = buf.indexOf("\n")) >= 0) {
					const line = buf.slice(0, nl).trim();
					buf = buf.slice(nl + 1);
					if (!line) continue;
					try {
						handleEvent(JSON.parse(line));
					} catch {
						/* non-JSON line */
					}
				}
			});
			child.stderr.on("data", (chunk: Buffer) => {
				stderrBuf += chunk.toString("utf8");
			});

			const exit: number = await new Promise((resolve) => {
				child.on("exit", (code) => resolve(code ?? 0));
				child.on("error", () => resolve(1));
			});

			ctx.ui.setWidget(widgetKey, []); // clear

			const finalText = finalTextChunks.length
				? finalTextChunks[finalTextChunks.length - 1]
				: stderrBuf.trim() || "(no output)";

			return {
				content: [{ type: "text", text: finalText }],
				isError: exit !== 0,
				details: { subagent: sub.name, exitCode: exit, model: sub.model },
			};
		},
	};

	pi.registerTool(taskDef as any);
}

// ─────────────────────────── utilities ───────────────────────────

function extractText(msg: any): string {
	const parts = msg?.content;
	if (!Array.isArray(parts)) return typeof msg?.content === "string" ? msg.content : "";
	return parts
		.filter((p: any) => p?.type === "text" && typeof p.text === "string")
		.map((p: any) => p.text)
		.join("");
}

function describeArgs(name: string, args: any): string {
	if (!args || typeof args !== "object") return "";
	if (name === "bash" && typeof args.command === "string") {
		return ` ${args.command.split("\n")[0].slice(0, 60)}`;
	}
	if (typeof args.path === "string") return ` ${args.path}`;
	if (typeof args.pattern === "string") return ` ${args.pattern}`;
	if (typeof args.query === "string") return ` ${args.query.slice(0, 40)}`;
	return "";
}
