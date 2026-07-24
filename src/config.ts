/**
 * Plugin configuration — env vars + optional factory options.
 * Defaults match Claude Code hindsight-memory + OpenCode hindsight-plus local mode.
 */

export type Budget = "low" | "mid" | "high";
export type DynamicBankField = "agent" | "project" | "gitProject" | "channel" | "user";

export interface OmpHindsightOptions {
	readonly hindsightApiUrl?: string;
	readonly hindsightApiToken?: string;
	readonly bankId?: string;
	readonly bankIdPrefix?: string;
	readonly dynamicBankId?: boolean;
	readonly dynamicBankGranularity?: readonly DynamicBankField[];
	readonly directoryBankMap?: Readonly<Record<string, string>>;
	readonly resolveWorktrees?: boolean;
	readonly agentName?: string;
	readonly bankMission?: string;
	readonly retainMission?: string;
	readonly autoRecall?: boolean;
	readonly autoRetain?: boolean;
	readonly retainEveryNTurns?: number;
	readonly retainOverlapTurns?: number;
	readonly recallBudget?: Budget;
	readonly reflectBudget?: Budget;
	readonly recallTypes?: readonly string[];
	readonly retainContext?: string;
	readonly enableKnowledgeTools?: boolean;
	readonly debug?: boolean;
}

export interface OmpHindsightConfig {
	readonly hindsightApiUrl: string;
	readonly hindsightApiToken: string;
	readonly bankId: string;
	readonly bankIdPrefix: string;
	readonly dynamicBankId: boolean;
	readonly dynamicBankGranularity: readonly DynamicBankField[];
	readonly directoryBankMap: Readonly<Record<string, string>>;
	readonly resolveWorktrees: boolean;
	readonly agentName: string;
	readonly bankMission: string;
	readonly retainMission: string;
	readonly autoRecall: boolean;
	readonly autoRetain: boolean;
	readonly retainEveryNTurns: number;
	readonly retainOverlapTurns: number;
	readonly recallBudget: Budget;
	readonly reflectBudget: Budget;
	readonly recallTypes: readonly string[];
	readonly retainContext: string;
	readonly enableKnowledgeTools: boolean;
	readonly debug: boolean;
}

const DEFAULT_API_URL = "http://localhost:8888";
const VALID_FIELDS = new Set<DynamicBankField>([
	"agent",
	"project",
	"gitProject",
	"channel",
	"user",
]);

function envString(name: string): string | undefined {
	const value = process.env[name];
	if (value === undefined || value.trim() === "") return undefined;
	return value.trim();
}

function envBool(name: string, fallback: boolean): boolean {
	const raw = envString(name);
	if (raw === undefined) return fallback;
	const lower = raw.toLowerCase();
	if (lower === "1" || lower === "true" || lower === "yes" || lower === "on") return true;
	if (lower === "0" || lower === "false" || lower === "no" || lower === "off") return false;
	return fallback;
}

function envInt(name: string, fallback: number): number {
	const raw = envString(name);
	if (raw === undefined) return fallback;
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseGranularity(raw: string | undefined): readonly DynamicBankField[] {
	if (!raw) return ["gitProject"];
	const fields = raw
		.split(/[,\s]+/)
		.map((f) => f.trim())
		.filter((f): f is DynamicBankField => VALID_FIELDS.has(f as DynamicBankField));
	return fields.length > 0 ? fields : ["gitProject"];
}

function parseDirectoryMap(raw: string | undefined): Readonly<Record<string, string>> {
	if (!raw) return {};
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
		const out: Record<string, string> = {};
		for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
			if (typeof v === "string" && v.trim()) out[k] = v.trim();
		}
		return out;
	} catch {
		return {};
	}
}

function asBudget(raw: string | undefined, fallback: Budget): Budget {
	if (raw === "low" || raw === "mid" || raw === "high") return raw;
	return fallback;
}

/** Load config: options override env; env overrides defaults. */
export function loadConfig(options: OmpHindsightOptions = {}): OmpHindsightConfig {
	const apiUrl =
		options.hindsightApiUrl ??
		envString("HINDSIGHT_API_URL") ??
		envString("OMP_HINDSIGHT_API_URL") ??
		DEFAULT_API_URL;

	const dynamicBankId =
		options.dynamicBankId ?? envBool("HINDSIGHT_DYNAMIC_BANK_ID", true);

	const granularity =
		options.dynamicBankGranularity ??
		parseGranularity(envString("HINDSIGHT_DYNAMIC_BANK_GRANULARITY"));

	return {
		hindsightApiUrl: apiUrl.replace(/\/+$/, ""),
		hindsightApiToken:
			options.hindsightApiToken ??
			envString("HINDSIGHT_API_TOKEN") ??
			envString("HINDSIGHT_API_KEY") ??
			"",
		bankId: options.bankId ?? envString("HINDSIGHT_BANK_ID") ?? "omp",
		bankIdPrefix: options.bankIdPrefix ?? envString("HINDSIGHT_BANK_ID_PREFIX") ?? "",
		dynamicBankId,
		dynamicBankGranularity: granularity,
		directoryBankMap:
			options.directoryBankMap ?? parseDirectoryMap(envString("HINDSIGHT_DIRECTORY_BANK_MAP")),
		resolveWorktrees: options.resolveWorktrees ?? envBool("HINDSIGHT_RESOLVE_WORKTREES", true),
		agentName: options.agentName ?? envString("HINDSIGHT_AGENT_NAME") ?? "omp",
		bankMission: options.bankMission ?? envString("HINDSIGHT_BANK_MISSION") ?? "",
		retainMission: options.retainMission ?? envString("HINDSIGHT_RETAIN_MISSION") ?? "",
		autoRecall: options.autoRecall ?? envBool("HINDSIGHT_AUTO_RECALL", true),
		autoRetain: options.autoRetain ?? envBool("HINDSIGHT_AUTO_RETAIN", true),
		retainEveryNTurns: options.retainEveryNTurns ?? envInt("HINDSIGHT_RETAIN_EVERY_N_TURNS", 10),
		retainOverlapTurns: options.retainOverlapTurns ?? envInt("HINDSIGHT_RETAIN_OVERLAP_TURNS", 2),
		recallBudget: asBudget(options.recallBudget ?? envString("HINDSIGHT_RECALL_BUDGET"), "mid"),
		reflectBudget: asBudget(options.reflectBudget ?? envString("HINDSIGHT_REFLECT_BUDGET"), "low"),
		recallTypes: options.recallTypes ?? [],
		retainContext: options.retainContext ?? envString("HINDSIGHT_RETAIN_CONTEXT") ?? "omp",
		enableKnowledgeTools:
			options.enableKnowledgeTools ?? envBool("HINDSIGHT_ENABLE_KNOWLEDGE_TOOLS", true),
		debug: options.debug ?? envBool("HINDSIGHT_DEBUG", false),
	};
}
