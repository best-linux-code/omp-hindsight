export type Budget = "low" | "mid" | "high" | string;
export type TagsMatch = "any" | "all" | "any_strict" | "all_strict";
export type UpdateMode = "replace" | "append";

export interface HindsightApiOptions {
	readonly baseUrl: string;
	readonly apiKey?: string;
	readonly userAgent?: string;
}

export interface RecallResult {
	readonly text: string;
	readonly type?: string | null;
	readonly mentioned_at?: string | null;
}

export interface RecallResponse {
	readonly results: RecallResult[];
}

export interface ReflectResponse {
	readonly text?: string;
}

export interface RetainResponse {
	readonly [key: string]: unknown;
}

export interface MentalModelSummary {
	readonly id?: string;
	readonly mental_model_id?: string;
	readonly name?: string;
	readonly source_query?: string;
	readonly content?: string;
	readonly tags?: readonly string[];
	readonly [key: string]: unknown;
}

export interface MentalModelListResponse {
	readonly items?: MentalModelSummary[];
}

export interface CreateMentalModelResponse {
	readonly id?: string;
	readonly mental_model_id?: string;
	readonly operation_id?: string;
	readonly [key: string]: unknown;
}

export interface MemoryItemInput {
	readonly content: string;
	readonly timestamp?: string;
	readonly context?: string;
	readonly metadata?: Readonly<Record<string, unknown>>;
	readonly documentId?: string;
	readonly tags?: readonly string[];
	readonly updateMode?: UpdateMode;
}
