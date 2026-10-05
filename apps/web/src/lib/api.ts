import type {
	AiStatusResponse,
	CreatedPackResponse,
	EditPackResponse,
	GeneratePackBody,
	PackSummary,
	SavePackBody,
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
	if (res.status === 204) return undefined as T;
	const body = await res.json().catch(() => null);
	if (!res.ok) {
		const err = (body as ErrorResponse | null)?.error;
		throw new ApiError(err?.code ?? 'bad_request', err?.message ?? 'Something went wrong');
	}
	return body as T;
}

let aiEnabled: Promise<boolean> | undefined;

export const api = {
	createRoom: (body: CreateRoomBody) =>
		request<SessionResponse>('/api/rooms', { method: 'POST', body: JSON.stringify(body) }),
	joinRoom: (code: string, body: JoinRoomBody) =>
		request<SessionResponse>(`/api/rooms/${encodeURIComponent(code)}/join`, {
			method: 'POST',
			body: JSON.stringify(body)
		}),
	roomInfo: (code: string) => request<RoomInfoResponse>(`/api/rooms/${encodeURIComponent(code)}`),

	packSummary: (code: string) => request<PackSummary>(`/api/packs/${encodeURIComponent(code)}`),
	createPack: (body: SavePackBody) =>
		request<CreatedPackResponse>('/api/packs', { method: 'POST', body: JSON.stringify(body) }),
	getPackForEdit: (code: string, token: string) =>
		request<EditPackResponse>(`/api/packs/${encodeURIComponent(code)}/edit`, {
			headers: { authorization: `Bearer ${token}` }
		}),
	updatePack: (code: string, token: string, body: SavePackBody) =>
		request<PackSummary>(`/api/packs/${encodeURIComponent(code)}`, {
			method: 'PUT',
			body: JSON.stringify(body),
			headers: { authorization: `Bearer ${token}` }
		}),
	deletePack: (code: string, token: string) =>
		request<void>(`/api/packs/${encodeURIComponent(code)}`, {
			method: 'DELETE',
			headers: { authorization: `Bearer ${token}` }
		}),

	aiStatus: () => request<AiStatusResponse>('/api/ai'),
	/** Whether this server has AI set up. Asked once per page load; it doesn't change. */
	aiEnabled: () =>
		(aiEnabled ??= request<AiStatusResponse>('/api/ai').then(
			(s) => s.enabled,
			() => false
		)),
	/** AI-written items for a solo game, from the server's pool. */
	aiItems: (kind: 'emoji' | 'icebreakers', flavour: number, n: number) =>
		request<{ items: unknown[] }>(`/api/ai/items?kind=${kind}&flavour=${flavour}&n=${n}`),
	generatePack: (body: GeneratePackBody) =>
		request<CreatedPackResponse>('/api/ai/packs', { method: 'POST', body: JSON.stringify(body) })
};
