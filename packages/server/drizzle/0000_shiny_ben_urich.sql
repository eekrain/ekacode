CREATE TABLE `events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`event_type` text NOT NULL,
	`properties` text NOT NULL,
	`directory` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `task_sessions`(`session_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_session_sequence` ON `events` (`session_id`,`sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `events_session_created` ON `events` (`session_id`,`created_at`);--> statement-breakpoint
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
CREATE TABLE `observational_memory` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text,
	`resource_id` text,
	`scope` text DEFAULT 'thread' NOT NULL,
	`lookup_key` text NOT NULL,
	`active_observations` text,
	`buffered_observation_chunks` text,
	`is_observing` integer DEFAULT 0,
	`is_reflecting` integer DEFAULT 0,
	`is_buffering_observation` integer DEFAULT 0,
	`is_buffering_reflection` integer DEFAULT 0,
	`last_buffered_at_tokens` integer,
	`last_buffered_at_time` integer,
	`observed_message_ids` text,
	`lock_owner_id` text,
	`lock_expires_at` integer,
	`lock_operation_id` text,
	`last_heartbeat_at` integer,
	`config` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_observed_at` integer,
	`generation_count` integer DEFAULT 0
);
--> statement-breakpoint
CREATE UNIQUE INDEX `observational_memory_lookup_key_unique` ON `observational_memory` (`lookup_key`);--> statement-breakpoint
CREATE TABLE `project_keypoints` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`task_session_id` text NOT NULL,
	`task_title` text NOT NULL,
	`milestone` text NOT NULL,
	`completed_at` integer NOT NULL,
	`summary` text NOT NULL,
	`artifacts` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_session_id`) REFERENCES `task_sessions`(`session_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_keypoints_workspace_completed_idx` ON `project_keypoints` (`workspace_id`,`completed_at`);--> statement-breakpoint
CREATE INDEX `project_keypoints_task_milestone_idx` ON `project_keypoints` (`task_session_id`,`milestone`);--> statement-breakpoint
CREATE TABLE `reflections` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_id` text,
	`thread_id` text,
	`content` text NOT NULL,
	`merged_from` text,
	`origin_type` text DEFAULT 'reflection',
	`generation_count` integer NOT NULL,
	`token_count` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `repo_cache` (
	`resource_key` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`ref` text NOT NULL,
	`search_path` text NOT NULL,
	`local_path` text NOT NULL,
	`commit_hash` text,
	`cloned_at` integer NOT NULL,
	`last_updated` integer NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE `task_run_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`task_session_id` text NOT NULL,
	`event_seq` integer NOT NULL,
	`event_type` text NOT NULL,
	`dedupe_key` text,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `task_session_runs`(`run_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_session_id`) REFERENCES `task_sessions`(`session_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_run_events_run_seq_unique` ON `task_run_events` (`run_id`,`event_seq`);--> statement-breakpoint
CREATE UNIQUE INDEX `task_run_events_run_dedupe_unique` ON `task_run_events` (`run_id`,`dedupe_key`);--> statement-breakpoint
CREATE INDEX `task_run_events_run_event_seq_idx` ON `task_run_events` (`run_id`,`event_seq`);--> statement-breakpoint
CREATE INDEX `task_run_events_session_event_seq_idx` ON `task_run_events` (`task_session_id`,`event_seq`);--> statement-breakpoint
CREATE TABLE `task_session_runs` (
	`run_id` text PRIMARY KEY NOT NULL,
	`task_session_id` text NOT NULL,
	`runtime_mode` text NOT NULL,
	`state` text DEFAULT 'queued' NOT NULL,
	`client_request_key` text,
	`input` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`queued_at` integer NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	`attempt` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`lease_owner` text,
	`lease_expires_at` integer,
	`last_heartbeat_at` integer,
	`cancel_requested_at` integer,
	`canceled_at` integer,
	`error_code` text,
	`error_message` text,
	FOREIGN KEY (`task_session_id`) REFERENCES `task_sessions`(`session_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_session_runs_session_created_idx` ON `task_session_runs` (`task_session_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `task_session_runs_session_state_idx` ON `task_session_runs` (`task_session_id`,`state`);--> statement-breakpoint
CREATE INDEX `task_session_runs_state_lease_idx` ON `task_session_runs` (`state`,`lease_expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `task_session_runs_session_request_key` ON `task_session_runs` (`task_session_id`,`client_request_key`);--> statement-breakpoint
CREATE TABLE `task_sessions` (
	`session_id` text PRIMARY KEY NOT NULL,
	`resource_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`parent_id` text,
	`workspace_id` text,
	`title` text,
	`summary` text,
	`share_url` text,
	`created_at` integer NOT NULL,
	`last_accessed` integer NOT NULL,
	`status` text DEFAULT 'researching' NOT NULL,
	`spec_type` text,
	`session_kind` text DEFAULT 'task' NOT NULL,
	`last_activity_at` integer NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `task_sessions`(`session_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `task_sessions_status_idx` ON `task_sessions` (`status`);--> statement-breakpoint
CREATE INDEX `task_sessions_kind_idx` ON `task_sessions` (`session_kind`);--> statement-breakpoint
CREATE INDEX `task_sessions_workspace_activity_idx` ON `task_sessions` (`workspace_id`,`last_activity_at`);--> statement-breakpoint
CREATE INDEX `task_sessions_workspace_kind_activity_idx` ON `task_sessions` (`workspace_id`,`session_kind`,`last_activity_at`);--> statement-breakpoint
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
CREATE TABLE `threads` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_id` text NOT NULL,
	`title` text NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tool_sessions` (
	`tool_session_id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`tool_key` text NOT NULL,
	`data` text,
	`created_at` integer NOT NULL,
	`last_accessed` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `task_sessions`(`session_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tool_sessions_session_tool_key` ON `tool_sessions` (`session_id`,`tool_name`,`tool_key`);--> statement-breakpoint
CREATE TABLE `working_memory` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_id` text NOT NULL,
	`scope` text DEFAULT 'resource' NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`base_branch` text,
	`repo_path` text,
	`is_merged` integer DEFAULT false,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`last_opened_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_path_unique` ON `workspaces` (`path`);--> statement-breakpoint
CREATE INDEX `workspaces_status_idx` ON `workspaces` (`status`);--> statement-breakpoint
CREATE INDEX `workspaces_last_opened_idx` ON `workspaces` (`last_opened_at`);--> statement-breakpoint
CREATE VIRTUAL TABLE IF NOT EXISTS `messages_fts` USING fts5(
  `search_text`,
  content='messages',
  content_rowid='rowid',
  tokenize='unicode61'
);--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `messages_fts_ai` AFTER INSERT ON `messages` BEGIN
  INSERT INTO messages_fts(rowid, search_text)
  VALUES (new.rowid, new.search_text);
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `messages_fts_ad` AFTER DELETE ON `messages` BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, search_text)
  VALUES ('delete', old.rowid, old.search_text);
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `messages_fts_au` AFTER UPDATE OF `search_text` ON `messages` BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, search_text)
  VALUES ('delete', old.rowid, old.search_text);
  INSERT INTO messages_fts(rowid, search_text)
  VALUES (new.rowid, new.search_text);
END;--> statement-breakpoint
CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
  title,
  description,
  content='tasks',
  content_rowid='rowid',
  tokenize='unicode61'
);--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS tasks_fts_ai AFTER INSERT ON tasks BEGIN
  INSERT INTO tasks_fts(rowid, title, description)
  VALUES (new.rowid, new.title, COALESCE(new.description, ''));
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS tasks_fts_ad AFTER DELETE ON tasks BEGIN
  INSERT INTO tasks_fts(tasks_fts, rowid, title, description)
  VALUES ('delete', old.rowid, old.title, COALESCE(old.description, ''));
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS tasks_fts_au AFTER UPDATE OF title, description ON tasks BEGIN
  INSERT INTO tasks_fts(tasks_fts, rowid, title, description)
  VALUES ('delete', old.rowid, old.title, COALESCE(old.description, ''));
  INSERT INTO tasks_fts(rowid, title, description)
  VALUES (new.rowid, new.title, COALESCE(new.description, ''));
END;