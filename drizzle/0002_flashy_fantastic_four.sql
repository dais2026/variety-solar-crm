CREATE TABLE `discovery_recordings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadPhone` varchar(20) NOT NULL,
	`leadName` varchar(255) NOT NULL,
	`title` varchar(255),
	`audioKey` varchar(512) NOT NULL,
	`audioUrl` text NOT NULL,
	`mimeType` varchar(64) NOT NULL,
	`durationSeconds` int,
	`transcript` text,
	`aiSummary` text,
	`transcriptionStatus` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`source` enum('live_recording','upload') NOT NULL,
	`userId` int,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `discovery_recordings_id` PRIMARY KEY(`id`)
);
