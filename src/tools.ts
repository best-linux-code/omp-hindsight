/**
 * Register all agent_knowledge_* tools.
 */

import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import type { PluginRuntime } from "./state.js";
import { registerPageTools } from "./tools-pages.js";
import { registerMemoryTools } from "./tools-memory.js";

export function registerKnowledgeTools(
	pi: ExtensionAPI,
	runtime: PluginRuntime,
): void {
	if (!runtime.config.enableKnowledgeTools) return;
	registerPageTools(pi, runtime);
	registerMemoryTools(pi, runtime);
}
