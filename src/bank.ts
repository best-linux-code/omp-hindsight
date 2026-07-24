/**
 * Bank ID derivation (Claude bank.py / OpenCode bank.ts gitProject model).
 */

import { execFileSync } from "node:child_process";
import { basename, dirname, resolve } from "node:path";
import { realpathSync } from "node:fs";
import type { OmpHindsightConfig, DynamicBankField } from "./config.js";
import type { HindsightApi } from "./client.js";

const DEFAULT_BANK_NAME = "omp";
const MISSION_SET_CAP = 10_000;
const VALID_FIELDS = new Set<DynamicBankField>([
	"agent",
	"project",
	"gitProject",
	"channel",
	"user",
]);

function safeRealpath(path: string): string {
	try {
		return realpathSync(path);
	} catch {
		return resolve(path);
	}
}

/** Main worktree root via git-common-dir, or null. */
export function getProjectRootFromGit(directory: string): string | null {
	if (!directory) return null;
	try {
		const commonDir = execFileSync(
			"git",
			["rev-parse", "--path-format=absolute", "--git-common-dir"],
			{
				cwd: directory,
				encoding: "utf-8",
				stdio: ["ignore", "pipe", "ignore"],
				timeout: 1000,
			},
		).trim();
		if (!commonDir) return null;
		if (basename(commonDir) === ".git") return dirname(commonDir);
		return commonDir;
	} catch {
		return null;
	}
}

function deriveGitProjectName(directory: string, resolveWorktrees: boolean): string {
	if (resolveWorktrees) {
		const projectRoot = getProjectRootFromGit(directory);
		if (projectRoot) return basename(projectRoot);
	}
	return directory ? basename(directory) : "unknown";
}

function bankFromDirectoryMap(
	directory: string,
	dirMap: Readonly<Record<string, string>>,
	resolveWorktrees: boolean,
): string | null {
	if (!directory || !Object.keys(dirMap).length) return null;

	const candidates = new Set<string>([safeRealpath(directory)]);
	if (resolveWorktrees) {
		const root = getProjectRootFromGit(directory);
		if (root) candidates.add(safeRealpath(root));
	}

	for (const [dirPath, bankId] of Object.entries(dirMap)) {
		if (!dirPath || !bankId) continue;
		if (candidates.has(safeRealpath(dirPath))) return bankId;
	}
	return null;
}

/**
 * Order: directoryBankMap → static bankId (when dynamic off) → dynamic fields joined by `::`.
 */
export function deriveBankId(config: OmpHindsightConfig, directory: string): string {
	const prefix = config.bankIdPrefix;
	const resolveWorktrees = config.resolveWorktrees;

	const mapped = bankFromDirectoryMap(directory, config.directoryBankMap, resolveWorktrees);
	if (mapped) {
		return prefix ? `${prefix}-${mapped}` : mapped;
	}

	if (!config.dynamicBankId) {
		const base = config.bankId || DEFAULT_BANK_NAME;
		return prefix ? `${prefix}-${base}` : base;
	}

	const fields = config.dynamicBankGranularity.length
		? config.dynamicBankGranularity
		: (["gitProject"] as const);

	const channelId = process.env.HINDSIGHT_CHANNEL_ID || "";
	const userId = process.env.HINDSIGHT_USER_ID || "";

	const resolvers: Record<DynamicBankField, () => string> = {
		agent: () => config.agentName || "omp",
		project: () => (directory ? basename(directory) : "unknown"),
		gitProject: () => deriveGitProjectName(directory, resolveWorktrees),
		channel: () => channelId || "default",
		user: () => userId || "anonymous",
	};

	const segments = fields.map((f) => {
		if (!VALID_FIELDS.has(f)) return "unknown";
		return resolvers[f]();
	});
	const baseBankId = segments.join("::");
	return prefix ? `${prefix}-${baseBankId}` : baseBankId;
}

/** Idempotent bank PUT + mission; tracks ids in banksSet. */
export async function ensureBank(
	client: HindsightApi,
	bankId: string,
	config: OmpHindsightConfig,
	banksSet: Set<string>,
): Promise<void> {
	if (banksSet.has(bankId)) return;

	const mission = config.bankMission.trim();
	const retainMission = config.retainMission.trim();

	try {
		await client.createBank(bankId, {
			reflectMission: mission || undefined,
			retainMission: retainMission || undefined,
		});
		banksSet.add(bankId);
		if (banksSet.size > MISSION_SET_CAP) {
			const keys = [...banksSet].sort();
			for (const key of keys.slice(0, keys.length >> 1)) {
				banksSet.delete(key);
			}
		}
	} catch {
		// Best-effort: downstream retain/recall surfaces real missing-bank errors.
	}
}
