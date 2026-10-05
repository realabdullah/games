CREATE TABLE `ai_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`flavour` text NOT NULL,
	`key` text NOT NULL,
	`item` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_items_kind_key` ON `ai_items` (`kind`,`key`);