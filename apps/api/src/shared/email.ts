import { env } from "../config";

interface SendEmailParams {
	to: string;
	subject: string;
	body: string;
	fromName?: string;
	replyTo?: string;
}

const PURPLE_BOX_API_URL = "https://api.thepurplebox.io/v1/send";

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const apiKey = env.PURPLE_BOX_API_KEY;
	
	if (!apiKey) throw new Error("Email service is not configured");

	const from = env.EMAIL_FROM || "noreply@executionos.com";

	const response = await fetch(PURPLE_BOX_API_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			from,
			to: params.to,
			subject: params.subject,
			body: params.body,
			from_name: params.fromName ?? "Execution OS",
			...(params.replyTo && { reply_to: params.replyTo }),
		}),
	});

	if (!response.ok) throw new Error("Failed to send email");
}
