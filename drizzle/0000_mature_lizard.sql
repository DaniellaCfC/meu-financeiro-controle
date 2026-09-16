CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`opening` integer NOT NULL,
	`opening_date` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "company_opening_integer" CHECK(typeof("companies"."opening") = 'integer' AND abs("companies"."opening") <= 99999999999)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_companies_owner` ON `companies` (`owner`);--> statement-breakpoint
CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`type` text NOT NULL,
	`description` text NOT NULL,
	`party` text NOT NULL,
	`category` text NOT NULL,
	`amount` integer NOT NULL,
	`due` text NOT NULL,
	`paid` text,
	`created_at` text NOT NULL,
	`paid_at` text,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "entry_type" CHECK("entries"."type" IN ('in','out')),
	CONSTRAINT "entry_amount_integer" CHECK(typeof("entries"."amount") = 'integer' AND "entries"."amount" BETWEEN 1 AND 99999999999)
);
--> statement-breakpoint
CREATE INDEX `idx_entries_company_due` ON `entries` (`company_id`,`due`);