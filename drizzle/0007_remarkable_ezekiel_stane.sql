CREATE TABLE `meetings_sent` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerName` varchar(255) NOT NULL,
	`customerEmail` varchar(320) NOT NULL,
	`customerPhone` varchar(20),
	`subject` varchar(500) NOT NULL,
	`location` text,
	`meetingStartTime` bigint NOT NULL,
	`meetingEndTime` bigint NOT NULL,
	`durationMinutes` int NOT NULL,
	`notes` text,
	`status` enum('scheduled','completed','cancelled') NOT NULL DEFAULT 'scheduled',
	`userId` int,
	`sentAt` bigint NOT NULL,
	CONSTRAINT `meetings_sent_id` PRIMARY KEY(`id`)
);
