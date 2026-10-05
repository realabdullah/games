import { sql } from 'drizzle-orm';
import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';

/** Custom and AI-generated content packs. Curated packs live in the repo, not here. */
export const packs = sqliteTable(
	'packs',
	{
		/** Public share code, e.g. "K7P2QX". Hosts type this to play the pack. */
		code: text('code').primaryKey(),
		game: text('game').notNull(),
		title: text('title').notNull(),
		/** The full pack as JSON (validated against the game's schema before saving). */
		content: text('content', { mode: 'json' }).notNull(),
		questionCount: integer('question_count').notNull(),
		/** SHA-256 of the secret edit token; the token itself is only ever shown to the creator. */
		editTokenHash: text('edit_token_hash').notNull(),
		source: text('source', { enum: ['custom', 'ai'] }).notNull(),
		/** Normalized AI prompt, so the same request reuses an earlier generation. */
		topicKey: text('topic_key'),
		/** Contains words the family filter blocks. */
		flagged: integer('flagged', { mode: 'boolean' }).notNull().default(false),
		plays: integer('plays').notNull().default(0),
		createdAt: integer('created_at')
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at')
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(t) => [index('packs_topic_key').on(t.topicKey)]
);

/** Daily AI generation counts, per client and in total, to cap spend. */
export const aiUsage = sqliteTable(
	'ai_usage',
	{
		day: text('day').notNull(),
		key: text('key').notNull(),
		count: integer('count').notNull().default(0)
	},
	(t) => [primaryKey({ columns: [t.day, t.key] })]
);

/**
 * AI-written game content (emoji riddles, icebreakers), kept so it can be
 * reused across rooms. Loaded into memory at startup; written only when a
 * background batch arrives.
 */
export const aiItems = sqliteTable(
	'ai_items',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** Which game it's for, e.g. "emoji". */
		kind: text('kind').notNull(),
		/** "naija" or "global". */
		flavour: text('flavour').notNull(),
		/** Normalized answer or prompt, to skip duplicates. */
		key: text('key').notNull(),
		/** The item as JSON. */
		item: text('item').notNull(),
		createdAt: integer('created_at').notNull()
	},
	(t) => [uniqueIndex('ai_items_kind_key').on(t.kind, t.key)]
);
