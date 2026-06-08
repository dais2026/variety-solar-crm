CREATE TABLE `sms_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`direction` enum('sent','received') NOT NULL,
	`phone` varchar(20) NOT NULL,
	`contactName` varchar(255),
	`message` text NOT NULL,
	`senderName` varchar(11),
	`parts` int NOT NULL DEFAULT 1,
	`cost` int DEFAULT 1,
	`status` enum('pending','delivered','failed','unknown') NOT NULL DEFAULT 'pending',
	`userId` int,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `sms_log_id` PRIMARY KEY(`id`)
);
