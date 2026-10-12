CREATE TABLE `casebooks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`original_key` text NOT NULL,
	`parsed` text NOT NULL,
	`edits` text DEFAULT '{}' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_casebooks_owner` ON `casebooks` (`owner`);--> statement-breakpoint
CREATE TABLE `casebook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`actor` text NOT NULL,
	`revision` integer NOT NULL,
	`detail` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `casebooks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_casebook_events_book` ON `casebook_events` (`book_id`);--> statement-breakpoint
CREATE TABLE `proof_files` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`object_key` text NOT NULL,
	`hash` text NOT NULL,
	`bytes` integer NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `casebooks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_proof_files_book` ON `proof_files` (`book_id`);