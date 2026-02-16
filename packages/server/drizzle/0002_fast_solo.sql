CREATE TABLE `threads` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_id` text NOT NULL,
	`title` text NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'open' NOT NULL,
	`priority` integer DEFAULT 2 NOT NULL,
	`type` text DEFAULT 'task' NOT NULL,
	`assignee` text,
	`session_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`closed_at` integer,
	`close_reason` text,
	`summary` text,
	`compaction_level` integer DEFAULT 0,
	`compacted_at` integer,
	`original_content` text,
	`metadata` text
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`resource_id` text,
	`role` text NOT NULL,
	`raw_content` text NOT NULL,
	`search_text` text NOT NULL,
	`injection_text` text NOT NULL,
	`task_id` text,
	`summary` text,
	`compaction_level` integer DEFAULT 0,
	`created_at` integer NOT NULL,
	`message_index` integer NOT NULL,
	`token_count` integer,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`event_type` text NOT NULL,
	`properties` text NOT NULL,
	`directory` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`session_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_session_sequence` ON `events` (`session_id`,`sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `events_session_created` ON `events` (`session_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `task_dependencies` (
	`task_id` text NOT NULL,
	`depends_on_id` text NOT NULL,
	`type` text DEFAULT 'blocks' NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`task_id`, `depends_on_id`, `type`),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`depends_on_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `task_messages` (
	`task_id` text NOT NULL,
	`message_id` text NOT NULL,
	`relation_type` text DEFAULT 'output',
	`created_at` integer NOT NULL,
	PRIMARY KEY(`task_id`, `message_id`),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`session_id` text PRIMARY KEY NOT NULL,
	`resource_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`parent_id` text,
	`title` text,
	`summary` text,
	`share_url` text,
	`created_at` integer NOT NULL,
	`last_accessed` integer NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `sessions`(`session_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_sessions`("session_id", "resource_id", "thread_id", "parent_id", "title", "summary", "share_url", "created_at", "last_accessed") SELECT "session_id", "resource_id", "thread_id", "parent_id", "title", "summary", "share_url", "created_at", "last_accessed" FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE VIRTUAL TABLE IF NOT EXISTS `messages_fts` USING fts5(
    search_text,
    content='messages',
    content_rowid='rowid',
    tokenize="unicode61 tokenchars '-_'"
);--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
    INSERT INTO messages_fts(rowid, search_text) VALUES (new.rowid, new.search_text);
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, search_text) VALUES('delete', old.rowid, old.search_text);
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, search_text) VALUES('delete', old.rowid, old.search_text);
    INSERT INTO messages_fts(rowid, search_text) VALUES (new.rowid, new.search_text);
END;
