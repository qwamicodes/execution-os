type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
	level: LogLevel;
	message: string;
	timestamp: string;
	context?: string;
	data?: Record<string, unknown>;
}

function log(
	level: LogLevel,
	message: string,
	context?: string,
	data?: Record<string, unknown>,
) {
	const entry: LogEntry = {
		level,
		message,
		timestamp: new Date().toISOString(),
		context,
		data,
	};

	const output = JSON.stringify(entry);

	switch (level) {
		case "error":
			console.error(output);
			break;
		case "warn":
			console.warn(output);
			break;
		default:
			console.log(output);
	}
}

export const logger = {
	debug: (message: string, context?: string, data?: Record<string, unknown>) =>
		log("debug", message, context, data),
	info: (message: string, context?: string, data?: Record<string, unknown>) =>
		log("info", message, context, data),
	warn: (message: string, context?: string, data?: Record<string, unknown>) =>
		log("warn", message, context, data),
	error: (message: string, context?: string, data?: Record<string, unknown>) =>
		log("error", message, context, data),
};
