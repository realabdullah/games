/**
 * A tiny Prometheus-format metrics registry. Enough for counters and gauges
 * with labels, without pulling in prom-client on a small, shared VPS.
 */

type Labels = Record<string, string>;

const key = (labels: Labels) =>
	Object.keys(labels)
		.sort()
		.map((k) => `${k}="${String(labels[k]).replace(/["\\\n]/g, '_')}"`)
		.join(',');

class Counter {
	private values = new Map<string, number>();
	constructor(
		readonly name: string,
		readonly help: string
	) {}

	inc(labels: Labels = {}, by = 1) {
		const k = key(labels);
		this.values.set(k, (this.values.get(k) ?? 0) + by);
	}

	get(labels: Labels = {}) {
		return this.values.get(key(labels)) ?? 0;
	}

	render(): string[] {
		const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
		if (this.values.size === 0) lines.push(`${this.name} 0`);
		for (const [k, v] of this.values) lines.push(`${this.name}${k ? `{${k}}` : ''} ${v}`);
		return lines;
	}
}

class Gauge {
	constructor(
		readonly name: string,
		readonly help: string,
		private read: () => number | [Labels, number][]
	) {}

	render(): string[] {
		const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} gauge`];
		const v = this.read();
		if (typeof v === 'number') lines.push(`${this.name} ${v}`);
		else for (const [labels, n] of v) lines.push(`${this.name}{${key(labels)}} ${n}`);
		return lines;
	}
}

export class Metrics {
	readonly roomsCreated = new Counter('games_rooms_created_total', 'Rooms created, by mode');
	readonly playersJoined = new Counter(
		'games_players_joined_total',
		'Players and audience who joined a room, by role'
	);
	readonly gamesStarted = new Counter('games_started_total', 'Games started, by game');
	readonly gamesFinished = new Counter('games_finished_total', 'Games played to the end, by game');
	readonly wsMessages = new Counter(
		'games_ws_messages_total',
		'WebSocket messages received, by type'
	);
	readonly packsCreated = new Counter(
		'games_packs_created_total',
		'Content packs created, by source'
	);
	readonly aiGenerations = new Counter('games_ai_generations_total', 'AI pack requests, by result');
	readonly snapshots = new Counter('games_snapshots_total', 'Room snapshots written, by reason');
	readonly errors = new Counter('games_errors_total', 'Unexpected server errors, by where');
	private gauges: Gauge[] = [];

	gauge(name: string, help: string, read: () => number | [Labels, number][]) {
		this.gauges.push(new Gauge(name, help, read));
	}

	render(): string {
		const counters = [
			this.roomsCreated,
			this.playersJoined,
			this.gamesStarted,
			this.gamesFinished,
			this.wsMessages,
			this.packsCreated,
			this.aiGenerations,
			this.snapshots,
			this.errors
		];
		return [...counters, ...this.gauges].flatMap((m) => m.render()).join('\n') + '\n';
	}
}
