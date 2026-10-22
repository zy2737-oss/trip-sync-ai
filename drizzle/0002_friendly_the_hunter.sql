CREATE TABLE `evidence_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `provider_slots` (
	`key` text PRIMARY KEY NOT NULL,
	`next_allowed_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `trip_groups` ADD `generated_at` text;