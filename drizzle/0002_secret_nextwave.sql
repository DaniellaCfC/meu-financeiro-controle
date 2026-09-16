ALTER TABLE `entries` ADD `installment_group` text;--> statement-breakpoint
ALTER TABLE `entries` ADD `installment` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `entries` ADD `installment_count` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `entries` ADD `request_key` text;--> statement-breakpoint
CREATE INDEX `idx_entries_company_group` ON `entries` (`company_id`,`installment_group`);