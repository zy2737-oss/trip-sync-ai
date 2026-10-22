CREATE TABLE `group_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`hits` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trip_groups` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`itinerary` text,
	`plan_revision` integer,
	`conflict_choice` text DEFAULT 'alternative' NOT NULL,
	`accepted_at` text,
	`generating_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trip_members` (
	`id` text PRIMARY KEY NOT NULL,
	`group_code` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`token_hash` text NOT NULL,
	`role` text NOT NULL,
	`answers` text,
	`place_choices` text,
	`completed` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`group_code`) REFERENCES `trip_groups`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_group_name` ON `trip_members` (`group_code`,`name_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `member_token` ON `trip_members` (`token_hash`);