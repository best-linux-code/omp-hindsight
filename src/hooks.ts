/**
 * Lifecycle hooks: session_start, context (auto-recall), agent_end / session_shutdown (retain),
 * session.compacting (preserve memory block).
 */

import type {
	ExtensionAPI,
	ExtensionContext,
	AgentMessage,
} from "@oh-my-pi/pi-coding-agent";
import { deriveBankId, ensureBank } from "./bank.js";
import {
	composeRecallQuery,
	countUserTurns,
	formatMemories,
	formatRetentionTranscript,
	injectMemoriesIntoMessages,
	sliceMessagesForRetain,
	wrapMemoriesBlock,
	type TextMessage,
} from "./content.js";
import type { PluginRuntime } from "./state.js";
import { isActive } from "./state.js";

async function detectBuiltInHindsight(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
): Promise<{ active: boolean; reason: string }> {
	// Prefer runtime memory status when available
	try {
		const mem = ctx.memory;
		if (mem && typeof mem.status === "function") {
			const st = await mem.status();
			if (st && typeof st === "object") {
				const backend = (st as { backend?: string }).backend;
				const active = (st as { active?: boolean }).active;
				if (backend === "hindsight" && active !== false) {
					return {
						active: true,
						reason:
							'built-in memory.backend="hindsight" is active (ctx.memory.status)',
					};
				}
			}
		}
	} catch {
		// ignore
	}

	// Best-effort settings probe (pi.pi may expose settings)
	try {
		const host = (pi as unknown as { pi?: { settings?: { get?: (k: string) => unknown } } })
			.pi;
		const settings = host?.settings;
		if (settings && typeof settings.get === "function") {
			const backend = settings.get("memory.backend");
			if (backend === "hindsight") {
				return {
					active: true,
					reason: 'settings memory.backend="hindsight"',
				};
			}
		}
	} catch {
		// ignore
	}

	return { active: false, reason: "" };
}

async function runRetain(
	runtime: PluginRuntime,
	messages: readonly TextMessage[],
	opts: { force: boolean; reason: string },
): Promise<void> {
	if (!isActive(runtime)) return;
	if (!runtime.config.autoRetain && !opts.force) return;

	const totalUsers = countUserTurns(messages);
	if (totalUsers === 0) return;

	const everyN = Math.max(1, runtime.config.retainEveryNTurns);
	const newTurns = totalUsers - runtime.lastRetainedUserTurn;
	if (!opts.force && newTurns < everyN) return;

	const slice = sliceMessagesForRetain(
		messages,
		runtime.lastRetainedUserTurn,
		runtime.config.retainOverlapTurns,
	);
	const content = formatRetentionTranscript(slice);
	if (!content.trim()) {
		runtime.lastRetainedUserTurn = totalUsers;
		return;
	}

	try {
		await ensureBank(
			runtime.client,
			runtime.bankId,
			runtime.config,
			runtime.banksSet,
		);
		await runtime.client.retain(runtime.bankId, content, {
			context: runtime.config.retainContext || "omp",
			async: true,
			// Hindsight API requires metadata values to be strings
			metadata: {
				source: "omp-hindsight",
				reason: opts.reason,
				userTurns: String(totalUsers),
			},
		});
		runtime.lastRetainedUserTurn = totalUsers;
		if (runtime.config.debug) {
			console.error(
				`[omp-hindsight] retained ${content.length} chars bank=${runtime.bankId} reason=${opts.reason}`,
			);
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		const details =
			err && typeof err === "object" && "details" in err
				? JSON.stringify((err as { details: unknown }).details)
				: "";
		console.error(
			`[omp-hindsight] retain failed: ${msg}${details ? ` ${details}` : ""}`,
		);
	}
}

export function registerHooks(pi: ExtensionAPI, runtime: PluginRuntime): void {
	pi.on("session_start", async (_event, ctx) => {
		const mutex = await detectBuiltInHindsight(pi, ctx);
		if (mutex.active) {
			runtime.disabled = true;
			runtime.disabledReason = mutex.reason;
			runtime.ready = false;
			ctx.ui.notify(
				`omp-hindsight disabled: ${mutex.reason}. Set memory.backend to "off" or "local".`,
				"warning",
			);
			return;
		}

		runtime.disabled = false;
		runtime.disabledReason = "";
		runtime.bankId = deriveBankId(runtime.config, ctx.cwd);
		runtime.lastRetainedUserTurn = 0;
		runtime.lastRecallFingerprint = "";

		try {
			await ensureBank(
				runtime.client,
				runtime.bankId,
				runtime.config,
				runtime.banksSet,
			);
			runtime.ready = true;
			const msg =
				`omp-hindsight ready · bank=${runtime.bankId} · api=${runtime.client.baseUrl}` +
				(runtime.config.autoRecall ? " · auto-recall" : "") +
				(runtime.config.autoRetain ? " · auto-retain" : "");
			ctx.ui.notify(msg, "info");
			if (runtime.config.debug) {
				// eslint-disable-next-line no-console
				console.error(`[omp-hindsight] ${msg}`);
			}
		} catch (err) {
			runtime.ready = false;
			const m = err instanceof Error ? err.message : String(err);
			ctx.ui.notify(`omp-hindsight bank setup failed: ${m}`, "error");
		}
	});

	pi.on("context", async (event, _ctx) => {
		if (!isActive(runtime) || !runtime.config.autoRecall) {
			if (runtime.config.debug) {
				console.error(
					`[omp-hindsight] context skip active=${isActive(runtime)} autoRecall=${runtime.config.autoRecall}`,
				);
			}
			return;
		}

		const messages = event.messages as AgentMessage[];
		const textMessages = messages as unknown as TextMessage[];
		const query = composeRecallQuery(textMessages);
		if (!query.trim()) {
			if (runtime.config.debug) {
				console.error("[omp-hindsight] context skip: empty recall query");
			}
			return;
		}

		// Same-turn tool-loop reuse: identical query → skip re-fetch
		if (query === runtime.lastRecallFingerprint) {
			if (runtime.config.debug) {
				console.error(
					`[omp-hindsight] context skip: same-query fingerprint (${query.length} chars)`,
				);
			}
			return;
		}

		try {
			await ensureBank(
				runtime.client,
				runtime.bankId,
				runtime.config,
				runtime.banksSet,
			);
			const res = await runtime.client.recall(runtime.bankId, query, {
				types:
					runtime.config.recallTypes.length > 0
						? [...runtime.config.recallTypes]
						: undefined,
				budget: runtime.config.recallBudget,
			});
			const results = res.results ?? [];
			if (!results.length) {
				runtime.lastRecallFingerprint = query;
				if (runtime.config.debug) {
					console.error(
						`[omp-hindsight] auto-recall: 0 hits bank=${runtime.bankId} q=${query.slice(0, 80)}`,
					);
				}
				return;
			}
			const body = formatMemories(results);
			const block = wrapMemoriesBlock(body);
			const next = injectMemoriesIntoMessages(messages, block);
			runtime.lastRecallFingerprint = query;
			if (runtime.config.debug) {
				console.error(
					`[omp-hindsight] auto-recall INJECT hits=${results.length} bank=${runtime.bankId} blockChars=${block.length}`,
				);
			}
			return { messages: next };
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`[omp-hindsight] auto-recall failed: ${msg}`);
			return;
		}
	});

	pi.on("agent_end", async (event, _ctx) => {
		if (event.willContinue) return;
		const messages = event.messages as unknown as TextMessage[];
		await runRetain(runtime, messages, {
			force: false,
			reason: "agent_end",
		});
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		let messages: TextMessage[] = [];
		try {
			const sm = ctx.sessionManager as {
				buildSessionContext?: () => { messages?: unknown[] };
				getBranch?: () => unknown[];
			};
			if (typeof sm.buildSessionContext === "function") {
				const ctxMsgs = sm.buildSessionContext().messages ?? [];
				messages = ctxMsgs as TextMessage[];
			}
		} catch {
			messages = [];
		}
		if (messages.length) {
			await runRetain(runtime, messages, {
				force: true,
				reason: "session_shutdown",
			});
		}
	});

	pi.on("session.compacting", async (event, _ctx) => {
		if (!isActive(runtime) || !runtime.config.autoRecall) return;

		const textMessages = event.messages as unknown as TextMessage[];
		const query = composeRecallQuery(textMessages);
		if (!query.trim()) return;

		try {
			const res = await runtime.client.recall(runtime.bankId, query, {
				types:
					runtime.config.recallTypes.length > 0
						? [...runtime.config.recallTypes]
						: undefined,
				budget: "low",
			});
			const results = res.results ?? [];
			if (!results.length) return;
			const body = formatMemories(results);
			const block = wrapMemoriesBlock(body);
			return {
				context: [block],
				preserveData: {
					ompHindsight: {
						bankId: runtime.bankId,
						lastRetainedUserTurn: runtime.lastRetainedUserTurn,
					},
				},
			};
		} catch {
			return;
		}
	});
}
