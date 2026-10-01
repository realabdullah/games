import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as schema from './schema.ts';

export type Db = ReturnType<typeof openDb>;

/** Open (or create) the database and apply pending migrations. Use ':memory:' in tests. */
export function openDb(path: string) {
	const sqlite = new Database(path, { create: true, strict: true });
	sqlite.run('PRAGMA journal_mode = WAL');
	sqlite.run('PRAGMA busy_timeout = 5000');
	const db = drizzle({ client: sqlite, schema });
	migrate(db, { migrationsFolder: new URL('../../drizzle', import.meta.url).pathname });
	return db;
}

export { schema };
