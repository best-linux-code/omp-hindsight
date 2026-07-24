/**
 * Hindsight HTTP client — facade over client-http + client-ops.
 */

import { hindsightRequest } from "./client-http.js";
import { createOps } from "./client-ops.js";
import type { HindsightApiOptions } from "./client-types.js";

export { HindsightError } from "./client-http.js";
export type * from "./client-types.js";

const DEFAULT_USER_AGENT = "omp-hindsight/0.1.0";

export class HindsightApi {
	readonly #baseUrl: string;
	readonly #headers: Record<string, string>;
	readonly #ops: ReturnType<typeof createOps>;

	constructor(options: HindsightApiOptions) {
		this.#baseUrl = options.baseUrl.replace(/\/+$/, "");
		this.#headers = {
			"User-Agent": options.userAgent ?? DEFAULT_USER_AGENT,
			"Content-Type": "application/json",
		};
		if (options.apiKey) {
			this.#headers.Authorization = `Bearer ${options.apiKey}`;
		}
		this.#ops = createOps((method, path, operation, opts) =>
			hindsightRequest(this.#baseUrl, this.#headers, method, path, operation, opts),
		);
	}

	get baseUrl(): string {
		return this.#baseUrl;
	}

	retain = (...args: Parameters<ReturnType<typeof createOps>["retain"]>) =>
		this.#ops.retain(...args);
	retainBatch = (...args: Parameters<ReturnType<typeof createOps>["retainBatch"]>) =>
		this.#ops.retainBatch(...args);
	recall = (...args: Parameters<ReturnType<typeof createOps>["recall"]>) =>
		this.#ops.recall(...args);
	reflect = (...args: Parameters<ReturnType<typeof createOps>["reflect"]>) =>
		this.#ops.reflect(...args);
	createBank = (...args: Parameters<ReturnType<typeof createOps>["createBank"]>) =>
		this.#ops.createBank(...args);
	listMentalModels = (...args: Parameters<ReturnType<typeof createOps>["listMentalModels"]>) =>
		this.#ops.listMentalModels(...args);
	getMentalModel = (...args: Parameters<ReturnType<typeof createOps>["getMentalModel"]>) =>
		this.#ops.getMentalModel(...args);
	createMentalModel = (...args: Parameters<ReturnType<typeof createOps>["createMentalModel"]>) =>
		this.#ops.createMentalModel(...args);
	updateMentalModel = (...args: Parameters<ReturnType<typeof createOps>["updateMentalModel"]>) =>
		this.#ops.updateMentalModel(...args);
	refreshMentalModel = (...args: Parameters<ReturnType<typeof createOps>["refreshMentalModel"]>) =>
		this.#ops.refreshMentalModel(...args);
	deleteMentalModel = (...args: Parameters<ReturnType<typeof createOps>["deleteMentalModel"]>) =>
		this.#ops.deleteMentalModel(...args);
}

export function createClient(baseUrl: string, apiKey?: string): HindsightApi {
	return new HindsightApi({
		baseUrl,
		apiKey: apiKey || undefined,
	});
}
