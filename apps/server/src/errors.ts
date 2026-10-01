import type { ErrorCode } from '@games/protocol';

/** An expected failure with a code the client understands (maps to an HTTP status). */
export class ApiError extends Error {
	constructor(
		readonly code: ErrorCode,
		message: string
	) {
		super(message);
	}
}
