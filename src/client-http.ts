/**
 * Low-level HTTP helpers for Hindsight API.
 */

export class HindsightError extends Error {
	readonly statusCode?: number;
	readonly details?: unknown;

	constructor(message: string, statusCode?: number, details?: unknown) {
		super(message);
		this.name = "HindsightError";
		this.statusCode = statusCode;
		this.details = details;
	}
}

const REQUEST_TIMEOUT_MS = 30_000;

export function pruneUndefined(value: unknown): unknown {
	if (value === null || typeof value !== "object") return value;
	if (Array.isArray(value)) return value.map(pruneUndefined);
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
		if (v === undefined) continue;
		out[k] = pruneUndefined(v);
	}
	return out;
}

function buildQueryString(query: Readonly<Record<string, unknown>>): string {
	const params = new URLSearchParams();
	for (const [k, v] of Object.entries(query)) {
		if (v === undefined || v === null) continue;
		params.set(k, String(v));
	}
	return params.toString();
}

function withTimeoutSignal(timeoutMs: number, parent?: AbortSignal): AbortSignal {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	const onParentAbort = () => controller.abort();
	if (parent) {
		if (parent.aborted) controller.abort();
		else parent.addEventListener("abort", onParentAbort, { once: true });
	}
	controller.signal.addEventListener(
		"abort",
		() => {
			clearTimeout(timer);
			parent?.removeEventListener("abort", onParentAbort);
		},
		{ once: true },
	);
	return controller.signal;
}

export async function hindsightRequest<T>(
	baseUrl: string,
	headers: Record<string, string>,
	method: string,
	path: string,
	operation: string,
	opts?: {
		readonly body?: unknown;
		readonly query?: Readonly<Record<string, unknown>>;
		readonly allow404?: boolean;
		readonly signal?: AbortSignal;
	},
): Promise<T> {
	let url = `${baseUrl}${path}`;
	if (opts?.query) {
		const qs = buildQueryString(opts.query);
		if (qs) url += `?${qs}`;
	}

	const init: RequestInit = {
		method,
		headers,
		signal: withTimeoutSignal(REQUEST_TIMEOUT_MS, opts?.signal),
	};
	if (opts?.body !== undefined) {
		init.body = JSON.stringify(pruneUndefined(opts.body));
	}

	let response: Response;
	try {
		response = await fetch(url, init);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (msg.includes("abort") || (err instanceof Error && err.name === "AbortError")) {
			throw new HindsightError(`${operation} request timed out after 30s`);
		}
		throw new HindsightError(`${operation} request failed: ${msg}`);
	}

	if (opts?.allow404 && response.status === 404) {
		return null as T;
	}

	if (!response.ok) {
		let details: unknown;
		let message = `${operation} failed: HTTP ${response.status}`;
		try {
			const body: unknown = await response.json();
			details = body;
			if (body && typeof body === "object") {
				const rec = body as Record<string, unknown>;
				const detail = rec.detail ?? rec.message ?? rec.error;
				if (typeof detail === "string" && detail.trim()) {
					message = `${operation} failed: ${detail}`;
				}
			}
		} catch {
			// ignore parse errors on error bodies
		}
		throw new HindsightError(message, response.status, details);
	}

	if (response.status === 204) {
		return { __deleted: true } as T;
	}

	const text = await response.text();
	if (!text.trim()) return {} as T;
	try {
		return JSON.parse(text) as T;
	} catch {
		return { text } as T;
	}
}
