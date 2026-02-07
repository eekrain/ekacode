ALTER TABLE `sessions` ADD `parent_id` text REFERENCES sessions(session_id);--> statement-breakpoint
ALTER TABLE `sessions` ADD `title` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `summary` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `share_url` text;