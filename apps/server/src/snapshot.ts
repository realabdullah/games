import { Database } from 'bun:sqlite';
import type { RoomSnapshot } from './rooms.ts';

/**
 * Live rooms are in memory. On shutdown we park them in SQLite and pick them
 * back up on boot, so a redeploy doesn't end games — clients just reconnect.
 */
export class SnapshotStore {
	private db: Database;

	constructor(path: string) {
		this.db = new Database(path, { create: true, strict: true });
		this.db.run('PRAGMA journal_mode = WAL');
		this.db.run(
			'CREATE TABLE IF NOT EXISTS room_snapshot (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL, saved_at INTEGER NOT NULL)'
		);
	}

	save(snapshot: RoomSnapshot) {
		this.db
			.query(
				'INSERT OR REPLACE INTO room_snapshot (id, data, saved_at) VALUES (1, $data, $savedAt)'
			)
			.run({ data: JSON.stringify(snapshot), savedAt: Date.now() });
	}

	/** Remove any saved snapshot (e.g. every room has closed). */
	clear() {
		this.db.run('DELETE FROM room_snapshot');
	}

	/** Returns the saved snapshot (if any) and clears it so it's only restored once. */
	take(maxAgeMs: number): RoomSnapshot | null {
		const row = this.db
			.query<{ data: string; saved_at: number }, []>(
				'SELECT data, saved_at FROM room_snapshot WHERE id = 1'
			)
			.get();
		this.db.run('DELETE FROM room_snapshot');
		if (!row || Date.now() - row.saved_at > maxAgeMs) return null;
		try {
			return JSON.parse(row.data) as RoomSnapshot;
		} catch (err) {
			console.error('room snapshot is corrupt; starting empty', err);
			return null;
		}
	}

	close() {
		this.db.close();
	}
}
