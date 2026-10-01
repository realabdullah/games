import type {
	CreateRoomBody,
	ErrorResponse,
	JoinRoomBody,
	RoomInfoResponse,
	SessionResponse
} from '@games/protocol';

export class ApiError extends Error {
	constructor(
		readonly code: ErrorResponse['error']['code'] | 'network',
		message: string
	) {
		super(message);
	}
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	let res: Response;
	try {
		res = await fetch(path, {
			...init,
			headers: { 'content-type': 'application/json', ...init?.headers }
		});
	} catch {
		throw new ApiError('network', 'Can’t reach the game server. Check your connection.');
	}
	const body = await res.json().catch(() => null);
	if (!res.ok) {
		const err = (body as ErrorResponse | null)?.error;
		throw new ApiError(err?.code ?? 'bad_request', err?.message ?? 'Something went wrong');
	}
	return body as T;
}

export const api = {
	createRoom: (body: CreateRoomBody) =>
		request<SessionResponse>('/api/rooms', { method: 'POST', body: JSON.stringify(body) }),
	joinRoom: (code: string, body: JoinRoomBody) =>
		request<SessionResponse>(`/api/rooms/${encodeURIComponent(code)}/join`, {
			method: 'POST',
			body: JSON.stringify(body)
		}),
	roomInfo: (code: string) => request<RoomInfoResponse>(`/api/rooms/${encodeURIComponent(code)}`)
};
