import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** A real game server process the tests can stop and restart. */
export class TestServer {
	private proc: ChildProcess | null = null;
	private dataDir = mkdtempSync(join(tmpdir(), 'games-e2e-'));

	constructor(readonly port: number) {}

	async start() {
		this.proc = spawn('bun', ['src/index.ts'], {
			cwd: join(import.meta.dirname, '../apps/server'),
			env: { ...process.env, PORT: String(this.port), DATA_DIR: this.dataDir },
			stdio: ['ignore', 'pipe', 'pipe']
		});
		this.proc.stderr?.on('data', (d) => process.stderr.write(`[server] ${d}`));
		await this.waitForHealth();
	}

	/** SIGTERM, like a redeploy: the server snapshots live rooms before exiting. */
	async stop() {
		const proc = this.proc;
		if (!proc || proc.exitCode !== null) return;
		const exited = new Promise((resolve) => proc.once('exit', resolve));
		proc.kill('SIGTERM');
		await exited;
		this.proc = null;
	}

	async restart() {
		await this.stop();
		await this.start();
	}

	async dispose() {
		await this.stop();
		rmSync(this.dataDir, { recursive: true, force: true });
	}

	private async waitForHealth() {
		for (let i = 0; i < 100; i++) {
			try {
				const res = await fetch(`http://localhost:${this.port}/health`);
				if (res.ok) return;
			} catch {}
			await new Promise((r) => setTimeout(r, 100));
		}
		throw new Error('game server did not start');
	}
}
