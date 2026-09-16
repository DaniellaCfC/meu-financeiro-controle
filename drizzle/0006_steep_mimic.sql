CREATE TABLE `billing_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`checkout_url` text NOT NULL,
	`support_email` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`valid_until` text,
	`revision` integer DEFAULT 0 NOT NULL,
	`requested_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `membership_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`actor` text NOT NULL,
	`valid_until` text,
	`reason` text NOT NULL,
	`payment_ref` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `members`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_membership_events_user` ON `membership_events` (`user_id`);