/**
 * Memory content helpers — strip tags, format recall, build retain transcripts.
 */

import type { RecallResult } from "./client.js";

const MEMORY_TAG_RE =
	/<(?:hindsight_memories|relevant_memories|memories|mental_models)>[\s\S]*?<\/(?:hindsight_memories|relevant_memories|memories|mental_models)>/gi;

const RECALL_QUERY_MAX = 4000;
const TOOL_INPUT_MAX = 500;
const TOOL_OUTPUT_MAX = 1000;

export interface TextMessage {
	readonly role: string;
	readonly content: unknown;
}

/** Strip injected memory blocks to prevent retain feedback loops. */
export function stripMemoryTags(content: string): string {
	return content.replace(MEMORY_TAG_RE, "").replace(/\n{3,}/g, "\n\n").trim();
}

export function formatMemories(results: readonly RecallResult[]): string {
	if (!results.length) return "";
	return results
		.map((r) => {
			const typeStr = r.type ? ` [${r.type}]` : "";
			const dateStr = r.mentioned_at ? ` (${r.mentioned_at})` : "";
			return `- ${r.text}${typeStr}${dateStr}`;
		})
		.join("\n\n");
}

export function formatCurrentTimeUtc(): string {
	const now = new Date();
	const y = now.getUTCFullYear();
	const m = String(now.getUTCMonth() + 1).padStart(2, "0");
	const d = String(now.getUTCDate()).padStart(2, "0");
	const h = String(now.getUTCHours()).padStart(2, "0");
	const min = String(now.getUTCMinutes()).padStart(2, "0");
	return `${y}-${m}-${d} ${h}:${min}`;
}

export function wrapMemoriesBlock(body: string): string {
	return (
		`<hindsight_memories>\n` +
		`Relevant memories from past conversations (prioritize recent when conflicting). ` +
		`Only use memories that are directly useful to continue this conversation; ignore the rest:\n` +
		`Current time: ${formatCurrentTimeUtc()} UTC\n\n` +
		`${body}\n` +
		`</hindsight_memories>`
	);
}

/** Extract plain text from AgentMessage-like content. */
export function extractText(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	const parts: string[] = [];
	for (const part of content) {
		if (!part || typeof part !== "object") continue;
		const rec = part as Record<string, unknown>;
		if (rec.type === "text" && typeof rec.text === "string") {
			parts.push(rec.text);
		}
	}
	return parts.join("\n");
}

export function countUserTurns(messages: readonly TextMessage[]): number {
	return messages.filter((m) => m.role === "user").length;
}

export function latestUserText(messages: readonly TextMessage[]): string {
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg?.role === "user") return stripMemoryTags(extractText(msg.content));
	}
	return "";
}

export function composeRecallQuery(messages: readonly TextMessage[]): string {
	const latest = latestUserText(messages);
	const prior: string[] = [];
	let seenLatest = false;
	for (let i = messages.length - 1; i >= 0 && prior.length < 6; i--) {
		const msg = messages[i];
		if (!msg || (msg.role !== "user" && msg.role !== "assistant")) continue;
		const text = stripMemoryTags(extractText(msg.content)).trim();
		if (!text) continue;
		if (!seenLatest && msg.role === "user" && text === latest) {
			seenLatest = true;
			continue;
		}
		prior.push(`[${msg.role}] ${text.slice(0, 400)}`);
	}
	prior.reverse();
	const composed = prior.length
		? `${prior.join("\n")}\n[user] ${latest}`
		: latest;
	return truncateQuery(composed);
}

function truncateQuery(query: string): string {
	if (query.length <= RECALL_QUERY_MAX) return query;
	return query.slice(query.length - RECALL_QUERY_MAX);
}

export function sanitizeForRetain(text: string): string {
	return stripMemoryTags(text).replace(/\u0000/g, "").trim();
}

export function isHindsightOperationalTool(name: string): boolean {
	const lower = name.toLowerCase();
	return (
		lower.startsWith("hindsight_") ||
		lower.startsWith("agent_knowledge_") ||
		/(?:^|__)(?:agent_knowledge_|knowledge_)/.test(lower)
	);
}

function truncate(text: string, max: number): string {
	if (text.length <= max) return text;
	return `${text.slice(0, max)}…`;
}

/** Format messages into a retain transcript with role markers. */
export function formatRetentionTranscript(messages: readonly TextMessage[]): string {
	const lines: string[] = [];
	for (const msg of messages) {
		if (msg.role === "user" || msg.role === "assistant") {
			const text = sanitizeForRetain(extractText(msg.content));
			if (!text) continue;
			lines.push(`[${msg.role}] ${text}`);
			continue;
		}
		// Tool results may appear as toolResult / tool messages
		if (msg.role === "toolResult" || msg.role === "tool") {
			const rec = msg as TextMessage & { toolName?: string; toolCallId?: string };
			const name = rec.toolName ?? "tool";
			if (isHindsightOperationalTool(name)) continue;
			const text = sanitizeForRetain(extractText(msg.content));
			if (!text) continue;
			lines.push(
				`[tool_result: ${name}] ${truncate(text, TOOL_OUTPUT_MAX)}`,
			);
		}
	}
	return lines.join("\n\n");
}

/**
 * Slice messages from lastRetained user-turn index (0-based exclusive end of prior retain)
 * with optional overlap of previous user turns.
 */
export function sliceMessagesForRetain(
	messages: readonly TextMessage[],
	lastRetainedUserTurn: number,
	overlapTurns: number,
): TextMessage[] {
	const userIndices: number[] = [];
	for (let i = 0; i < messages.length; i++) {
		if (messages[i]?.role === "user") userIndices.push(i);
	}
	const totalUsers = userIndices.length;
	if (totalUsers === 0) return [];

	const startUser = Math.max(0, lastRetainedUserTurn - Math.max(0, overlapTurns));
	const startIdx = userIndices[startUser] ?? 0;
	return messages.slice(startIdx);
}

/** Clone message list and inject/replace memories block on the latest user message. */
export function injectMemoriesIntoMessages<T extends TextMessage>(
	messages: readonly T[],
	block: string,
): T[] {
	if (!messages.length) return [...messages];

	let lastUser = -1;
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i]?.role === "user") {
			lastUser = i;
			break;
		}
	}
	if (lastUser < 0) return [...messages];

	const out = [...messages];
	const target = out[lastUser];
	if (!target) return out;

	const existing = extractText(target.content);
	const cleaned = stripMemoryTags(existing);
	const nextText = cleaned ? `${block}\n\n${cleaned}` : block;

	if (typeof target.content === "string") {
		out[lastUser] = { ...target, content: nextText };
		return out;
	}

	if (Array.isArray(target.content)) {
		const content = [...target.content] as Array<Record<string, unknown>>;
		let replaced = false;
		for (let i = 0; i < content.length; i++) {
			const part = content[i];
			if (part?.type === "text" && typeof part.text === "string") {
				const partClean = stripMemoryTags(part.text);
				content[i] = {
					...part,
					text: partClean ? `${block}\n\n${partClean}` : block,
				};
				replaced = true;
				break;
			}
		}
		if (!replaced) {
			content.unshift({ type: "text", text: block });
		}
		out[lastUser] = { ...target, content };
		return out;
	}

	out[lastUser] = { ...target, content: nextText };
	return out;
}

export function toDocumentId(title: string): string {
	return (
		title
			.trim()
			.toLowerCase()
			.replace(/\s+/g, "-")
			.replace(/[^a-z0-9._-]/g, "")
			.slice(0, 200) || "document"
	);
}

export function formatPageSummary(page: Readonly<Record<string, unknown>>): string {
	const id = String(page.id ?? page.mental_model_id ?? "?");
	const name = String(page.name ?? "(unnamed)");
	const query = page.source_query ? String(page.source_query) : "";
	return query ? `- ${id}: ${name}\n  source_query: ${query}` : `- ${id}: ${name}`;
}

export function formatPageDetail(page: Readonly<Record<string, unknown>>): string {
	const id = String(page.id ?? page.mental_model_id ?? "?");
	const name = String(page.name ?? "(unnamed)");
	const query = page.source_query != null ? String(page.source_query) : "";
	const content = page.content != null ? String(page.content) : "(no content yet)";
	return [
		`id: ${id}`,
		`name: ${name}`,
		query ? `source_query: ${query}` : null,
		"",
		content,
	]
		.filter((line): line is string => line !== null)
		.join("\n");
}

// Keep tool-size constants referenced so tree-shakers don't drop documentation intent
void TOOL_INPUT_MAX;
