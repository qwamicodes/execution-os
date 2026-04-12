export interface CanonicalLog {
	request_id: string;
	method: string;
	path: string;
	timestamp: string;
	status_code?: number;
	duration_ms?: number;
	outcome?: "success" | "error";
	sample_reason:
		| "error"
		| "slow_request"
		| "sampled"
		| "vital_operation_sampled"
		| "dropped";
	wide_events: Record<string, unknown>;
	error?: {
		name: string;
		message: string;
		stack?: string;
	};
}

export interface RequestLogger {
	set: (key: string, value: unknown) => void;
	capture: (err: unknown) => void;
	_emit: (statusCode: number) => CanonicalLog | null;
	_sample: () => void;
}

interface SamplingInput {
	statusCode: number;
	durationMs: number;
	shouldSample: boolean;
	slowRequestThresholdMs: number;
	successSampleRate: number;
}

function evaluateSampling(input: SamplingInput): {
	shouldEmit: boolean;
	sampleReason: CanonicalLog["sample_reason"];
} {
	if (input.statusCode >= 400) {
		return { shouldEmit: true, sampleReason: "error" };
	}

	if (input.durationMs >= input.slowRequestThresholdMs) {
		return { shouldEmit: true, sampleReason: "slow_request" };
	}

	if (input.shouldSample) {
		return { shouldEmit: true, sampleReason: "vital_operation_sampled" };
	}

	if (Math.random() < input.successSampleRate) {
		return { shouldEmit: true, sampleReason: "sampled" };
	}

	return { shouldEmit: false, sampleReason: "dropped" };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function mergeValue(oldValue: unknown, newValue: unknown): unknown {
	if (Array.isArray(oldValue) && Array.isArray(newValue)) {
		return oldValue.concat(newValue);
	}
	if (isPlainObject(oldValue) && isPlainObject(newValue)) {
		return { ...oldValue, ...newValue };
	}
	return newValue;
}

export function createRequestLogger(input: {
	requestId: string;
	method: string;
	path: string;
	userAgent?: string;
	startedAt: number;
	slowRequestThresholdMs: number;
	successSampleRate: number;
}): RequestLogger {
	const wideEvents: Record<string, unknown> = {};
	if (input.userAgent) {
		wideEvents.user_agent = input.userAgent;
	}

	let sampled = false;
	let capturedError: CanonicalLog["error"];

	return {
		set(key, value) {
			if (key in wideEvents) {
				wideEvents[key] = mergeValue(wideEvents[key], value);
				return;
			}
			wideEvents[key] = value;
		},

		capture(err) {
			if (err instanceof Error) {
				capturedError = {
					name: err.name,
					message: err.message,
					stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
				};
				return;
			}
			capturedError = {
				name: "UnknownError",
				message: String(err),
			};
		},

		_emit(statusCode) {
			const durationMs = Math.round(performance.now() - input.startedAt);
			const outcome = statusCode >= 400 ? "error" : "success";
			const sampling = evaluateSampling({
				statusCode,
				durationMs,
				shouldSample: sampled,
				slowRequestThresholdMs: input.slowRequestThresholdMs,
				successSampleRate: input.successSampleRate,
			});

			if (!sampling.shouldEmit) {
				return null;
			}

			return {
				request_id: input.requestId,
				method: input.method,
				path: input.path,
				timestamp: new Date().toISOString(),
				status_code: statusCode,
				duration_ms: durationMs,
				outcome,
				sample_reason: sampling.sampleReason,
				wide_events: { ...wideEvents },
				error: capturedError,
			};
		},

		_sample() {
			sampled = true;
		},
	};
}
