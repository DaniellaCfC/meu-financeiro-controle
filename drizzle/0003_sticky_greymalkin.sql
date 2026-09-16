CREATE TABLE `entry_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_id` text NOT NULL,
	`company_id` text NOT NULL,
	`action` text NOT NULL,
	`actor` text NOT NULL,
	`reason` text NOT NULL,
	`before_json` text,
	`after_json` text NOT NULL,
	`occurred_at` text NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_history_company_entry` ON `entry_history` (`company_id`,`entry_id`,`id`);--> statement-breakpoint
ALTER TABLE `entries` ADD `revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `entries` ADD `updated_by` text;--> statement-breakpoint
ALTER TABLE `entries` ADD `change_reason` text;--> statement-breakpoint
ALTER TABLE `entries` ADD `last_mutation_id` text;--> statement-breakpoint
ALTER TABLE `entries` ADD `last_mutation_key` text;