/**
 * omp-hindsight — standalone Hindsight long-term memory extension for OhMyPi.
 *
 * Claude-aligned agent_knowledge_* tools + auto recall/retain lifecycle.
 * Requires a running Hindsight API (default http://localhost:8888).
 * Mutually exclusive with built-in memory.backend=hindsight.
 *
 * Install: add to ~/.omp/omp.json extensions, or place under packages and
 * reference path. Set memory.backend to "off" (or "local") so this plugin owns the loop.
 */

import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { loadConfig, type OmpHindsightOptions } from "./config.js";
import { createClient } from "./client.js";
import { deriveBankId } from "./bank.js";
import { createRuntime } from "./state.js";
import { registerHooks } from "./hooks.js";
import { registerKnowledgeTools } from "./tools.js";

export type { OmpHindsightOptions, OmpHindsightConfig } from "./config.js";
export { HindsightApi, HindsightError, createClient } from "./client.js";
export { deriveBankId, ensureBank, getProjectRootFromGit } from "./bank.js";
export {
	stripMemoryTags,
	formatMemories,
	formatRetentionTranscript,
	injectMemoriesIntoMessages,
} from "./content.js";

/**
 * Factory: `export default function(pi)` for OhMyPi ExtensionAPI.
 * Optional options for programmatic embedding (tests / wrappers).
 */
export function createOmpHindsightExtension(options: OmpHindsightOptions = {}) {
	return (pi: ExtensionAPI): void => {
		const config = loadConfig(options);
		const client = createClient(
			config.hindsightApiUrl,
			config.hindsightApiToken || undefined,
		);
		// Provisional bank; session_start re-derives from ctx.cwd
		const bankId = deriveBankId(config, process.cwd());
		const runtime = createRuntime(config, client, bankId);

		registerHooks(pi, runtime);
		registerKnowledgeTools(pi, runtime);

		if (config.debug) {
			// eslint-disable-next-line no-console
			console.error(
				`[omp-hindsight] loaded api=${config.hindsightApiUrl} bank=${bankId} tools=${config.enableKnowledgeTools}`,
			);
		}
	};
}

/** OhMyPi extension entry — default export required by ExtensionAPI loader. */
export default createOmpHindsightExtension();
