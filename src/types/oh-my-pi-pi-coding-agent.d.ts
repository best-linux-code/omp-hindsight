/**
 * Minimal ExtensionAPI surface used by omp-hindsight.
 * At runtime OhMyPi provides the real module; this stub keeps typecheck standalone.
 */
declare module "@oh-my-pi/pi-coding-agent" {
	export type AgentMessage = {
		role: string;
		content: unknown;
		[key: string]: unknown;
	};

	export type ExtensionContext = {
		cwd: string;
		sessionManager: {
			buildSessionContext?: () => { messages?: unknown[] };
			getBranch?: () => unknown[];
			[key: string]: unknown;
		};
		ui: {
			notify: (message: string, level?: "info" | "warning" | "error") => void;
			[key: string]: unknown;
		};
		memory?: {
			status?: () => Promise<{ backend?: string; active?: boolean } | unknown>;
			[key: string]: unknown;
		};
		hasUI?: boolean;
		[key: string]: unknown;
	};

	export type AgentToolResult<TDetails = unknown> = {
		content: Array<{ type: "text"; text: string } | { type: string; [k: string]: unknown }>;
		details?: TDetails;
	};

	export type AgentToolUpdateCallback<TDetails = unknown> = (
		partial: AgentToolResult<TDetails>,
	) => void;

	export type ToolDefinition = {
		name: string;
		label: string;
		description: string;
		parameters: unknown;
		execute: (
			toolCallId: string,
			params: any,
			signal: AbortSignal | undefined,
			onUpdate: AgentToolUpdateCallback | undefined,
			ctx: ExtensionContext,
		) => Promise<AgentToolResult>;
		[key: string]: unknown;
	};

	export type ZodNamespace = {
		z: {
			object: (shape: Record<string, unknown>) => unknown;
			string: () => {
				describe: (d: string) => unknown;
				optional: () => {
					describe: (d: string) => unknown;
				};
			};
			optional?: unknown;
			[key: string]: unknown;
		};
		[key: string]: unknown;
	};

	export type ExtensionAPI = {
		registerTool: (tool: ToolDefinition) => void;
		on: (event: string, handler: (event: any, ctx: ExtensionContext) => any) => void;
		zod: ZodNamespace;
		logger?: { debug?: (...args: unknown[]) => void; [key: string]: unknown };
		pi?: { settings?: { get?: (key: string) => unknown }; [key: string]: unknown };
		[key: string]: unknown;
	};

	const _default: unknown;
	export default _default;
}
