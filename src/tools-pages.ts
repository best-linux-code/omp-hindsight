/**
 * Knowledge page tools (list/get/create/update/delete/refresh).
 */

import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { ensureBank } from "./bank.js";
import { HindsightError } from "./client.js";
import { formatPageDetail, formatPageSummary } from "./content.js";
import type { PluginRuntime } from "./state.js";

type ToolResult = {
	content: Array<{ type: "text"; text: string }>;
	details?: unknown;
};

function textResult(text: string, details?: unknown): ToolResult {
	return { content: [{ type: "text", text }], details };
}

function errResult(err: unknown): ToolResult {
	if (err instanceof HindsightError) {
		return textResult(`Error: ${err.message}`, {
			statusCode: err.statusCode,
			details: err.details,
		});
	}
	return textResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
}

function requireRuntime(runtime: PluginRuntime): string | null {
	if (runtime.disabled) {
		return (
			`omp-hindsight is disabled: ${runtime.disabledReason || "mutex with built-in memory.backend=hindsight"}. ` +
			`Set memory.backend to "off" or "local" to use this extension.`
		);
	}
	if (!runtime.ready) {
		return "omp-hindsight is not ready yet (session_start has not completed).";
	}
	return null;
}

async function withBank(
	runtime: PluginRuntime,
	fn: (bankId: string) => Promise<ToolResult>,
): Promise<ToolResult> {
	const gate = requireRuntime(runtime);
	if (gate) return textResult(gate);
	await ensureBank(runtime.client, runtime.bankId, runtime.config, runtime.banksSet);
	return fn(runtime.bankId);
}

export function registerPageTools(pi: ExtensionAPI, runtime: PluginRuntime): void {
	const { z } = pi.zod;

	pi.registerTool({
		name: "agent_knowledge_list_pages",
		label: "List knowledge pages",
		description:
			"List knowledge pages (IDs and names) in the current Hindsight bank. Pages are synthesized long-lived docs rebuilt from memory via a source_query.",
		parameters: z.object({}),
		async execute(_id, _params, signal, _onUpdate, _ctx) {
			return withBank(runtime, async (bankId) => {
				try {
					const res = await runtime.client.listMentalModels(bankId, {
						detail: "metadata",
						signal,
					});
					const items = res.items ?? [];
					if (!items.length) return textResult("No knowledge pages in this bank.");
					return textResult(
						items.map((p) => formatPageSummary(p as Record<string, unknown>)).join("\n"),
						{ count: items.length, items },
					);
				} catch (err) {
					return errResult(err);
				}
			});
		},
	});

	pi.registerTool({
		name: "agent_knowledge_get_page",
		label: "Get knowledge page",
		description:
			"Read a knowledge page by id. Returns full synthesized content when available.",
		parameters: z.object({
			page_id: z.string().describe("Knowledge page / mental-model id."),
		}),
		async execute(_id, params, signal, _onUpdate, _ctx) {
			return withBank(runtime, async (bankId) => {
				try {
					const page = await runtime.client.getMentalModel(bankId, params.page_id, {
						detail: "content",
						signal,
					});
					if (!page) return textResult(`Page not found: ${params.page_id}`);
					return textResult(formatPageDetail(page as Record<string, unknown>), { page });
				} catch (err) {
					return errResult(err);
				}
			});
		},
	});

	pi.registerTool({
		name: "agent_knowledge_create_page",
		label: "Create knowledge page",
		description:
			"Create a knowledge page. source_query is re-asked after consolidations to rebuild the page from observations.",
		parameters: z.object({
			name: z.string().describe("Human-readable page title."),
			source_query: z
				.string()
				.describe("Question used to synthesize/refresh page content from memories."),
			page_id: z
				.string()
				.optional()
				.describe("Optional stable page id. Server generates one if omitted."),
		}),
		async execute(_id, params, signal, _onUpdate, _ctx) {
			return withBank(runtime, async (bankId) => {
				try {
					const res = await runtime.client.createMentalModel(
						bankId,
						params.name,
						params.source_query,
						{ id: params.page_id, signal },
					);
					const id =
						res.id ?? res.mental_model_id ?? params.page_id ?? "(server-assigned)";
					return textResult(`Created knowledge page "${params.name}" (id: ${id}).`, {
						response: res,
					});
				} catch (err) {
					return errResult(err);
				}
			});
		},
	});

	pi.registerTool({
		name: "agent_knowledge_update_page",
		label: "Update knowledge page",
		description: "Update a knowledge page name and/or source_query.",
		parameters: z.object({
			page_id: z.string().describe("Knowledge page id."),
			name: z.string().optional().describe("New title."),
			source_query: z.string().optional().describe("New synthesis question."),
		}),
		async execute(_id, params, signal, _onUpdate, _ctx) {
			if (!params.name && !params.source_query) {
				return textResult("Error: provide name and/or source_query to update.");
			}
			return withBank(runtime, async (bankId) => {
				try {
					await runtime.client.updateMentalModel(bankId, params.page_id, {
						name: params.name,
						sourceQuery: params.source_query,
						signal,
					});
					return textResult(`Updated knowledge page ${params.page_id}.`);
				} catch (err) {
					return errResult(err);
				}
			});
		},
	});

	pi.registerTool({
		name: "agent_knowledge_delete_page",
		label: "Delete knowledge page",
		description: "Permanently delete a knowledge page.",
		parameters: z.object({
			page_id: z.string().describe("Knowledge page id to delete."),
		}),
		async execute(_id, params, signal, _onUpdate, _ctx) {
			return withBank(runtime, async (bankId) => {
				try {
					const ok = await runtime.client.deleteMentalModel(bankId, params.page_id, {
						signal,
					});
					if (!ok) return textResult(`Page not found: ${params.page_id}`);
					return textResult(`Deleted knowledge page ${params.page_id}.`);
				} catch (err) {
					return errResult(err);
				}
			});
		},
	});

	pi.registerTool({
		name: "agent_knowledge_refresh_page",
		label: "Refresh knowledge page",
		description:
			"Refresh a knowledge page now by re-running its source_query against current memories.",
		parameters: z.object({
			page_id: z.string().describe("Knowledge page id to refresh."),
		}),
		async execute(_id, params, signal, _onUpdate, _ctx) {
			return withBank(runtime, async (bankId) => {
				try {
					await runtime.client.refreshMentalModel(bankId, params.page_id, { signal });
					return textResult(`Refresh started for knowledge page ${params.page_id}.`);
				} catch (err) {
					return errResult(err);
				}
			});
		},
	});
}

export { requireRuntime, withBank, textResult, errResult };
