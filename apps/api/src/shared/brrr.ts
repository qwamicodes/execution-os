import { env } from "../config";

interface BrrrNotificationInput {
	title?: string;
	subtitle?: string;
	message: string;
	threadId?: string;
	sound?: string;
	openUrl?: string;
	imageUrl?: string;
	interruptionLevel?: "passive" | "active" | "time-sensitive";
}

const BRRR_API_BASE = "https://api.brrr.now/v1";

function normalizeWebhookUrl(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) return "";
	if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
		return trimmed;
	}
	return `${BRRR_API_BASE}/${trimmed}`;
}

export function getBrrrWebhookUrl(): string | null {
	const explicit = normalizeWebhookUrl(env.BRRR_WEBHOOK_URL ?? "");
	if (explicit) return explicit;

	const fromSecret = normalizeWebhookUrl(env.BRRR_WEBHOOK_SECRET ?? "");
	if (fromSecret) return fromSecret;

	return null;
}

export async function sendBrrrNotification(
	input: BrrrNotificationInput,
): Promise<void> {
	const webhookUrl = getBrrrWebhookUrl();
	if (!webhookUrl) {
		throw new Error("brrr webhook is not configured");
	}

	const response = await fetch(webhookUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			title: input.title,
			subtitle: input.subtitle,
			message: input.message,
			thread_id: input.threadId,
			sound: input.sound ?? env.BRRR_DEFAULT_SOUND,
			open_url: input.openUrl,
			image_url: input.imageUrl,
			interruption_level: input.interruptionLevel,
		}),
	});

	if (!response.ok) {
		const details = await response.text().catch(() => "");
		throw new Error(
			`Failed to send brrr notification: ${response.status} ${details}`,
		);
	}
}
