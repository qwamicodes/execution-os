import { randomUUID } from "node:crypto";
import { env } from "../../config";
import { logger } from "../../shared/logger";

export interface RealtimeEventEnvelope<T = unknown> {
	id: string;
	type: string;
	timestamp: string;
	data: T;
}

type EventSubscriber = (event: RealtimeEventEnvelope) => void;

const subscribersByUser = new Map<string, Set<EventSubscriber>>();

function formatSSE(event: RealtimeEventEnvelope): string {
	return [
		`id: ${event.id}`,
		`event: ${event.type}`,
		`data: ${JSON.stringify(event)}`,
		"",
	].join("\n");
}

function addSubscriber(userId: string, subscriber: EventSubscriber) {
	const subscribers = subscribersByUser.get(userId) ?? new Set<EventSubscriber>();
	subscribers.add(subscriber);
	subscribersByUser.set(userId, subscribers);

	return () => {
		const current = subscribersByUser.get(userId);
		if (!current) return;
		current.delete(subscriber);
		if (current.size === 0) {
			subscribersByUser.delete(userId);
		}
	};
}

export function publishRealtimeEvent<T>(
	userId: string,
	type: string,
	data: T,
): void {
	const subscribers = subscribersByUser.get(userId);
	if (!subscribers || subscribers.size === 0) return;

	const event: RealtimeEventEnvelope<T> = {
		id: randomUUID(),
		type,
		timestamp: new Date().toISOString(),
		data,
	};

	for (const subscriber of subscribers) {
		try {
			subscriber(event);
		} catch (error) {
			logger.warn({
				event: "realtime_subscriber_delivery_failed",
				user_id: userId,
				realtime_event_type: type,
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}
}

export function createRealtimeStreamResponse(userId: string): Response {
	const encoder = new TextEncoder();
	let unsubscribe = () => {};
	let heartbeat: ReturnType<typeof setInterval> | null = null;

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const send = (event: RealtimeEventEnvelope) => {
				controller.enqueue(encoder.encode(`${formatSSE(event)}\n`));
			};

			send({
				id: randomUUID(),
				type: "connected",
				timestamp: new Date().toISOString(),
				data: { userId },
			});

			unsubscribe = addSubscriber(userId, (event) => {
				send(event);
			});

			heartbeat = setInterval(() => {
				send({
					id: randomUUID(),
					type: "heartbeat",
					timestamp: new Date().toISOString(),
					data: {},
				});
			}, env.REALTIME_HEARTBEAT_MS);
		},
		cancel() {
			if (heartbeat) {
				clearInterval(heartbeat);
				heartbeat = null;
			}
			unsubscribe();
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no",
		},
	});
}
