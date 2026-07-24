/**
 * Memory tools: bank, recall, reflect, ingest.
 */

import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { toDocumentId } from "./content.js";
import type { PluginRuntime } from "./state.js";
import {
	errResult,
	requireRuntime,
	textResult,
	withBank,
} from "./tools-pages.js";

export function registerMemoryTools(pi: ExtensionAPI, runtime: PluginRuntime): void {
	const { z } = pi.zod;

	pi.registerTool({
		name: "agent_knowledge_get_current_bank",
		label: "Get current Hindsight bank",
		description:
			"Get the current Hindsight memory bank ID this session is bound to.",
		parameters: z.object({}),
		async execute(_id, _params, _signal, _onUpdate, _ctx) {
			const gate = requireRuntime(runtime);
			if (gate) return textResult(gate);
			return textResult(runtime.bankId, {
				bankId: runtime.bankId,
				apiUrl: runtime.client.baseUrl,
			});
		},
	});

	pi.registerTool({
		name: "agent_knowledge_recall",
		label: "Recall memories",
		description:
			"Search long-term memory for relevant information. Call proactively before answering about past work, preferences, or project history.",
		parameters: z.object({
			query: z.string().describe("Natural language search query for raw memories."),
		}),
		async execute(_id, params, signal, _onUpdate, _ctx) {
			return withBank(runtime, async (bankId) => {
				try {
					const res = await runtime.client.recall(bankId, params.query, {
						types:
							runtime.config.recallTypes.length > 0
								? [...runtime.config.recallTypes]
								: undefined,
						budget: runtime.config.recallBudget,
						signal,
					});
					const results = res.results ?? [];
					if (!results.length) return textResult("No matching memories found.");
					const body = results
						.map((r) => {
							const t = r.type ? ` [${r.type}]` : "";
							const d = r.mentioned_at ? ` (${r.mentioned_at})` : "";
							return `- ${r.text}${t}${d}`;
						})
						.join("\n\n");
					return textResult(body, { count: results.length });
				} catch (err) {
					return errResult(err);
				}
			});
		},
	});

	pi.registerTool({
		name: "agent_knowledge_reflect",
		label: "Reflect on memories",
		description:
			"Generate a thoughtful answer using long-term memory (synthesizes memories into a coherent answer).",
		parameters: z.object({
			query: z.string().describe("The question to answer using long-term memory."),
			context: z
				.string()
				.optional()
				.describe("Optional additional context to guide the reflection."),
		}),
		async execute(_id, params, signal, _onUpdate, _ctx) {
			return withBank(runtime, async (bankId) => {
				try {
					const res = await runtime.client.reflect(bankId, params.query, {
						context: params.context,
						budget: runtime.config.reflectBudget,
						signal,
					});
					return textResult(res.text?.trim() || "(empty reflection)", {
						response: res,
					});
				} catch (err) {
					return errResult(err);
				}
			});
		},
	});

	pi.registerTool({
		name: "agent_knowledge_ingest",
		label: "Ingest document",
		description:
			"Upload text content into the memory bank as a named document. Re-ingesting the same title replaces the document.",
		parameters: z.object({
			title: z.string().describe("Document title; becomes the document ID."),
			content: z
				.string()
				.describe("Full raw text content to store (do not summarize first)."),
		}),
		async execute(_id, params, signal, _onUpdate, _ctx) {
			return withBank(runtime, async (bankId) => {
				try {
					const documentId = toDocumentId(params.title);
					await runtime.client.retain(bankId, params.content, {
						documentId,
						updateMode: "replace",
						context: runtime.config.retainContext || "omp-ingest",
						async: true,
						signal,
					});
					return textResult(
						`Ingested document "${params.title}" (document_id: ${documentId}).`,
						{ documentId },
					);
				} catch (err) {
					return errResult(err);
				}
			});
		},
	});

	pi.registerTool({
		name: "agent_knowledge_ingest_file",
		label: "Ingest file",
		description:
			"Ingest a file from disk into the memory bank. Filename (without extension) becomes the document ID.",
		parameters: z.object({
			file_path: z
				.string()
				.describe("Absolute or relative path to a UTF-8 text file."),
		}),
		async execute(_id, params, signal, _onUpdate, ctx: ExtensionContext) {
			return withBank(runtime, async (bankId) => {
				try {
					const resolved = params.file_path.startsWith("/")
						? params.file_path
						: resolvePath(ctx.cwd, params.file_path);
					const content = readFileSync(resolved, "utf-8");
					const base = resolved.split("/").pop() ?? "document";
					const title = base.replace(/\.[^.]+$/, "") || base;
					const documentId = toDocumentId(title);
					await runtime.client.retain(bankId, content, {
						documentId,
						updateMode: "replace",
						context: runtime.config.retainContext || "omp-ingest-file",
						async: true,
						signal,
					});
					return textResult(
						`Ingested file "${resolved}" as document "${title}" (document_id: ${documentId}).`,
						{ documentId, path: resolved },
					);
				} catch (err) {
					return errResult(err);
				}
			});
		},
	});
}
