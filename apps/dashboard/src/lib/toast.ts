import { goeyToast as toast } from "goey-toast";
import { ApiClientError } from "@/lib/api";

function extractApiErrorMessage(error: unknown): string {
	if (error instanceof ApiClientError) {
		if (error.status === 503 && error.code === "SERVICE_UNAVAILABLE") {
			if (error.details) {
				try {
					const parsed = JSON.parse(error.details) as
						| {
								details?: {
									errors?: Array<{
										provider?: string;
										message?: string;
									}>;
								};
								errors?: Array<{ provider?: string; message?: string }>;
						  }
						| undefined;
					const nested = parsed?.details ?? parsed;
					const first = nested?.errors?.[0];
					if (first?.message) {
						const provider = first.provider?.toUpperCase() ?? "AI provider";
						return `${provider} failed: ${first.message}`;
					}
				} catch {
					// ignore JSON parse errors for details payload
				}
			}
		}
		return error.message;
	}
	return error instanceof Error ? error.message : "Action failed";
}

export async function runWithPromiseToast<T>(
	label: string,
	runner: () => Promise<T>,
	options?: {
		loadingMessage?: string;
		successMessage?: string | ((data: T) => string);
		errorMessage?: string | ((error: unknown) => string);
	},
) {
	const promise = runner();
	await toast.promise(promise, {
		loading: options?.loadingMessage ?? `${label}...`,
		success: (data) =>
			typeof options?.successMessage === "function"
				? options.successMessage(data)
				: (options?.successMessage ?? `${label} completed`),
		error: (error) =>
			typeof options?.errorMessage === "function"
				? options.errorMessage(error)
				: (options?.errorMessage ?? extractApiErrorMessage(error)),
	});
	return promise;
}
