/**
 * Per-process plugin state (shared across sessions in the same agent process).
 */

import type { HindsightApi } from "./client.js";
import type { OmpHindsightConfig } from "./config.js";

export interface PluginRuntime {
	readonly config: OmpHindsightConfig;
	readonly client: HindsightApi;
	/** Banks we already PUT successfully. */
	readonly banksSet: Set<string>;
	/** Hard mutex: built-in memory.backend=hindsight is active. */
	disabled: boolean;
	disabledReason: string;
	/** Resolved bank for the current cwd/session. */
	bankId: string;
	/** Last user-turn count successfully retained (exclusive end). */
	lastRetainedUserTurn: number;
	/** Fingerprint of last auto-recalled user text (dedupe same turn). */
	lastRecallFingerprint: string;
	/** True after session_start successfully initialized. */
	ready: boolean;
}

export function createRuntime(
	config: OmpHindsightConfig,
	client: HindsightApi,
	bankId: string,
): PluginRuntime {
	return {
		config,
		client,
		banksSet: new Set(),
		disabled: false,
		disabledReason: "",
		bankId,
		lastRetainedUserTurn: 0,
		lastRecallFingerprint: "",
		ready: false,
	};
}

export function isActive(runtime: PluginRuntime): boolean {
	return runtime.ready && !runtime.disabled;
}
