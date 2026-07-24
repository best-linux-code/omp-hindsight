/**
 * Hindsight API operations bound to a request function.
 */

import type {
	Budget,
	CreateMentalModelResponse,
	MemoryItemInput,
	MentalModelListResponse,
	MentalModelSummary,
	RecallResponse,
	ReflectResponse,
	RetainResponse,
	TagsMatch,
	UpdateMode,
} from "./client-types.js";

export type RequestFn = <T>(
	method: string,
	path: string,
	operation: string,
	opts?: {
		readonly body?: unknown;
		readonly query?: Readonly<Record<string, unknown>>;
		readonly allow404?: boolean;
		readonly signal?: AbortSignal;
	},
) => Promise<T>;

function buildMemoryItem(item: MemoryItemInput): Record<string, unknown> {
	return {
		content: item.content,
		timestamp: item.timestamp,
		context: item.context,
		metadata: item.metadata,
		document_id: item.documentId,
		tags: item.tags,
		update_mode: item.updateMode,
	};
}

export function createOps(req: RequestFn) {
	return {
		retain(
			bankId: string,
			content: string,
			options?: {
				readonly context?: string;
				readonly tags?: readonly string[];
				readonly metadata?: Readonly<Record<string, unknown>>;
				readonly documentId?: string;
				readonly updateMode?: UpdateMode;
				readonly async?: boolean;
				readonly signal?: AbortSignal;
			},
		): Promise<RetainResponse> {
			const item = buildMemoryItem({
				content,
				context: options?.context,
				tags: options?.tags,
				metadata: options?.metadata,
				documentId: options?.documentId,
				updateMode: options?.updateMode,
			});
			return req("POST", `/v1/default/banks/${encodeURIComponent(bankId)}/memories`, "retain", {
				body: { items: [item], async: options?.async ?? true },
				signal: options?.signal,
			});
		},

		retainBatch(
			bankId: string,
			items: readonly MemoryItemInput[],
			options?: { readonly async?: boolean; readonly signal?: AbortSignal },
		): Promise<RetainResponse> {
			return req(
				"POST",
				`/v1/default/banks/${encodeURIComponent(bankId)}/memories`,
				"retainBatch",
				{
					body: {
						items: items.map(buildMemoryItem),
						async: options?.async ?? true,
					},
					signal: options?.signal,
				},
			);
		},

		recall(
			bankId: string,
			query: string,
			options?: {
				readonly types?: readonly string[];
				readonly maxTokens?: number;
				readonly budget?: Budget;
				readonly tags?: readonly string[];
				readonly tagsMatch?: TagsMatch;
				readonly signal?: AbortSignal;
			},
		): Promise<RecallResponse> {
			return req(
				"POST",
				`/v1/default/banks/${encodeURIComponent(bankId)}/memories/recall`,
				"recall",
				{
					body: {
						query,
						types: options?.types,
						max_tokens: options?.maxTokens,
						budget: options?.budget ?? "mid",
						tags: options?.tags,
						tags_match: options?.tagsMatch,
					},
					signal: options?.signal,
				},
			);
		},

		reflect(
			bankId: string,
			query: string,
			options?: {
				readonly context?: string;
				readonly budget?: Budget;
				readonly tags?: readonly string[];
				readonly tagsMatch?: TagsMatch;
				readonly signal?: AbortSignal;
			},
		): Promise<ReflectResponse> {
			return req("POST", `/v1/default/banks/${encodeURIComponent(bankId)}/reflect`, "reflect", {
				body: {
					query,
					context: options?.context,
					budget: options?.budget ?? "low",
					tags: options?.tags,
					tags_match: options?.tagsMatch,
				},
				signal: options?.signal,
			});
		},

		createBank(
			bankId: string,
			options: {
				readonly reflectMission?: string;
				readonly retainMission?: string;
				readonly signal?: AbortSignal;
			} = {},
		): Promise<unknown> {
			return req("PUT", `/v1/default/banks/${encodeURIComponent(bankId)}`, "createBank", {
				body: {
					reflect_mission: options.reflectMission,
					retain_mission: options.retainMission,
				},
				signal: options.signal,
			});
		},

		listMentalModels(
			bankId: string,
			options?: {
				readonly detail?: "metadata" | "content" | "full";
				readonly signal?: AbortSignal;
			},
		): Promise<MentalModelListResponse> {
			return req(
				"GET",
				`/v1/default/banks/${encodeURIComponent(bankId)}/mental-models`,
				"listMentalModels",
				{ query: { detail: options?.detail ?? "metadata" }, signal: options?.signal },
			);
		},

		getMentalModel(
			bankId: string,
			mentalModelId: string,
			options?: {
				readonly detail?: "metadata" | "content" | "full";
				readonly signal?: AbortSignal;
			},
		): Promise<MentalModelSummary | null> {
			return req(
				"GET",
				`/v1/default/banks/${encodeURIComponent(bankId)}/mental-models/${encodeURIComponent(mentalModelId)}`,
				"getMentalModel",
				{
					query: { detail: options?.detail ?? "content" },
					allow404: true,
					signal: options?.signal,
				},
			);
		},

		createMentalModel(
			bankId: string,
			name: string,
			sourceQuery: string,
			options?: {
				readonly id?: string;
				readonly tags?: readonly string[];
				readonly maxTokens?: number;
				readonly signal?: AbortSignal;
			},
		): Promise<CreateMentalModelResponse> {
			return req(
				"POST",
				`/v1/default/banks/${encodeURIComponent(bankId)}/mental-models`,
				"createMentalModel",
				{
					body: {
						id: options?.id,
						name,
						source_query: sourceQuery,
						tags: options?.tags,
						max_tokens: options?.maxTokens,
						trigger: { refresh_after_consolidation: true },
					},
					signal: options?.signal,
				},
			);
		},

		updateMentalModel(
			bankId: string,
			mentalModelId: string,
			options: {
				readonly name?: string;
				readonly sourceQuery?: string;
				readonly signal?: AbortSignal;
			},
		): Promise<unknown> {
			return req(
				"PATCH",
				`/v1/default/banks/${encodeURIComponent(bankId)}/mental-models/${encodeURIComponent(mentalModelId)}`,
				"updateMentalModel",
				{
					body: { name: options.name, source_query: options.sourceQuery },
					signal: options.signal,
				},
			);
		},

		refreshMentalModel(
			bankId: string,
			mentalModelId: string,
			options?: { readonly signal?: AbortSignal },
		): Promise<unknown> {
			return req(
				"POST",
				`/v1/default/banks/${encodeURIComponent(bankId)}/mental-models/${encodeURIComponent(mentalModelId)}/refresh`,
				"refreshMentalModel",
				{ body: {}, signal: options?.signal },
			);
		},

		async deleteMentalModel(
			bankId: string,
			mentalModelId: string,
			options?: { readonly signal?: AbortSignal },
		): Promise<boolean> {
			const result = await req<{ __deleted: boolean } | null>(
				"DELETE",
				`/v1/default/banks/${encodeURIComponent(bankId)}/mental-models/${encodeURIComponent(mentalModelId)}`,
				"deleteMentalModel",
				{ allow404: true, signal: options?.signal },
			);
			return result !== null;
		},
	};
}
