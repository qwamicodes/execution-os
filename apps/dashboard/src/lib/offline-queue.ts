const OFFLINE_QUEUE_KEY = "execution-os-offline-queue";

export interface OfflineOperation {
	id: string;
	path: string;
	method: string;
	headers: Record<string, string>;
	body?: string;
	createdAt: number;
	attempts: number;
}

function readQueue(): OfflineOperation[] {
	if (typeof window === "undefined") return [];
	const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY);
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw) as OfflineOperation[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function writeQueue(queue: OfflineOperation[]) {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
	window.dispatchEvent(
		new CustomEvent("execution-os:offline-queue-updated", {
			detail: { size: queue.length },
		}),
	);
}

function createId() {
	return `offline_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getOfflineQueueSize() {
	return readQueue().length;
}

export function canQueueRequest(options?: RequestInit): boolean {
	const method = (options?.method || "GET").toUpperCase();
	if (!["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
		return false;
	}
	if (
		typeof FormData !== "undefined" &&
		options?.body &&
		options.body instanceof FormData
	) {
		return false;
	}
	if (
		options?.body !== undefined &&
		typeof options.body !== "string" &&
		!(options.body instanceof URLSearchParams)
	) {
		return false;
	}
	return true;
}

export function enqueueOfflineOperation(
	path: string,
	options?: RequestInit,
): OfflineOperation | null {
	if (!canQueueRequest(options)) return null;

	const method = (options?.method || "GET").toUpperCase();
	const headers = new Headers(options?.headers);
	const entry: OfflineOperation = {
		id: createId(),
		path,
		method,
		headers: Object.fromEntries(headers.entries()),
		body:
			typeof options?.body === "string"
				? options.body
				: options?.body instanceof URLSearchParams
					? options.body.toString()
					: undefined,
		createdAt: Date.now(),
		attempts: 0,
	};

	const queue = readQueue();
	queue.push(entry);
	writeQueue(queue);

	return entry;
}

export async function processOfflineQueue(params: {
	apiBaseUrl: string;
}): Promise<{ processed: number; failed: number }> {
	if (typeof window === "undefined" || !navigator.onLine) {
		return { processed: 0, failed: 0 };
	}

	const queue = readQueue();
	if (queue.length === 0) return { processed: 0, failed: 0 };

	const remaining: OfflineOperation[] = [];
	let processed = 0;
	let failed = 0;

	for (const operation of queue) {
		try {
			const response = await fetch(
				`${params.apiBaseUrl}/api/v1${operation.path}`,
				{
					method: operation.method,
					headers: operation.headers,
					body: operation.body,
					credentials: "include",
				},
			);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}
			processed += 1;
		} catch {
			failed += 1;
			remaining.push({ ...operation, attempts: operation.attempts + 1 });
		}
	}

	writeQueue(remaining);
	return { processed, failed };
}
