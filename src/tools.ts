/**
 * Register all agent_knowledge_* tools.
 *
 * Tools are registered with loadMode "essential" so they appear in the
 * top-level tool list (OhMyPi defaults extension tools to "discoverable").
 */

import type { ExtensionAPI, ToolDefinition } from "@oh-my-pi/pi-coding-agent";
import type { PluginRuntime } from "./state.js";
import { registerPageTools } from "./tools-pages.js";
import { registerMemoryTools } from "./tools-memory.js";

function withEssentialTools(pi: ExtensionAPI): ExtensionAPI {
	const original = pi.registerTool.bind(pi);
	return {
		...pi,
		registerTool(tool: ToolDefinition) {
			original({
				...tool,
				loadMode: tool.loadMode ?? "essential",
			});
		},
	} as ExtensionAPI;
}

export function registerKnowledgeTools(
	pi: ExtensionAPI,
	runtime: PluginRuntime,
): void {
	if (!runtime.config.enableKnowledgeTools) return;
	const toolsApi = withEssentialTools(pi);
	registerPageTools(toolsApi, runtime);
	registerMemoryTools(toolsApi, runtime);
}
