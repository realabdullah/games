CREATE TABLE `ai_usage` (
	`day` text NOT NULL,
	`key` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `key`)
);
--> statement-breakpoint
CREATE TABLE `packs` (
	`code` text PRIMARY KEY NOT NULL,
	`game` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`question_count` integer NOT NULL,
	`edit_token_hash` text NOT NULL,
	`source` text NOT NULL,
	`topic_key` text,
	`flagged` integer DEFAULT false NOT NULL,
	`plays` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `packs_topic_key` ON `packs` (`topic_key`);