import { packIsProfane, type TriviaPack, type TriviaPackDraft } from '@games/content';
import {
	PACK_CODE_ALPHABET,
	PACK_CODE_LENGTH,
	type CreatedPackResponse,
	type EditPackResponse,
	type PackSummary
} from '@games/protocol';
import { eq, sql } from 'drizzle-orm';
import type { Db } from './db/index.ts';
import { packs } from './db/schema.ts';
import { ApiError } from './errors.ts';

type PackRow = typeof packs.$inferSelect;

/**
 * Custom and AI-generated packs. There are no accounts: whoever creates a pack
 * gets a secret edit token (we store only its hash) and a public share code.
 */
export class PackStore {
	constructor(
		private db: Db,
		private now: () => number = Date.now
	) {}

	create(
		draft: TriviaPackDraft,
		opts: { source: 'custom' | 'ai' } = { source: 'custom' }
	): CreatedPackResponse {
		const editToken = newToken();
		const t = this.now();
		for (let attempt = 0; attempt < 10; attempt++) {
			const code = newCode();
			try {
				const [row] = this.db
					.insert(packs)
					.values({
						code,
						game: 'trivia',
						title: draft.title,
						content: draft,
						questionCount: draft.questions.length,
						editTokenHash: hashToken(editToken),
						source: opts.source,
						flagged: packIsProfane(draft),
						createdAt: t,
						updatedAt: t
					})
					.returning()
					.all();
				return { summary: summarize(row!), editToken };
			} catch (err) {
				if (!String(err).includes('UNIQUE')) throw err;
			}
		}
		throw new Error('Could not allocate a pack code');
	}

	summary(code: string): PackSummary {
		return summarize(this.mustGet(code));
	}

	getForEdit(code: string, token: string): EditPackResponse {
		const row = this.mustOwn(code, token);
		return { summary: summarize(row), pack: row.content as TriviaPackDraft };
	}

	update(code: string, token: string, draft: TriviaPackDraft): PackSummary {
		this.mustOwn(code, token);
		const [row] = this.db
			.update(packs)
			.set({
				title: draft.title,
				content: draft,
				questionCount: draft.questions.length,
				flagged: packIsProfane(draft),
				updatedAt: this.now()
			})
			.where(eq(packs.code, code.toUpperCase()))
			.returning()
			.all();
		return summarize(row!);
	}

	delete(code: string, token: string) {
		this.mustOwn(code, token);
		this.db.delete(packs).where(eq(packs.code, code.toUpperCase())).run();
	}

	/** Load a pack to play. Returns null if there's no such pack. */
	forPlay(code: string): { pack: TriviaPack; flagged: boolean } | null {
		const row = this.find(code);
		if (!row) return null;
		return { pack: { ...(row.content as TriviaPackDraft), id: row.code }, flagged: row.flagged };
	}

	recordPlay(code: string) {
		this.db
			.update(packs)
			.set({ plays: sql`${packs.plays} + 1` })
			.where(eq(packs.code, code.toUpperCase()))
			.run();
	}

	private find(code: string): PackRow | undefined {
		return this.db.select().from(packs).where(eq(packs.code, code.trim().toUpperCase())).get();
	}

	private mustGet(code: string): PackRow {
		const row = this.find(code);
		if (!row) throw new ApiError('not_found', 'No pack with that code');
		return row;
	}

	private mustOwn(code: string, token: string): PackRow {
		const row = this.mustGet(code);
		if (!token || hashToken(token) !== row.editTokenHash) {
			throw new ApiError('forbidden', 'That edit link isn’t valid for this pack');
		}
		return row;
	}
}

function summarize(row: PackRow): PackSummary {
	const content = row.content as TriviaPackDraft;
	return {
		code: row.code,
		game: 'trivia',
		title: row.title,
		description: content.description,
		emoji: content.emoji,
		count: row.questionCount,
		source: row.source,
		flagged: row.flagged
	};
}

function newCode(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(PACK_CODE_LENGTH));
	return Array.from(bytes, (b) => PACK_CODE_ALPHABET[b % PACK_CODE_ALPHABET.length]).join('');
}

function newToken(): string {
	return Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('base64url');
}

export function hashToken(token: string): string {
	return new Bun.CryptoHasher('sha256').update(token).digest('hex');
}
