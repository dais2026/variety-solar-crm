CREATE TABLE `sms_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateKey` varchar(50) NOT NULL,
	`messageBody` text NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `sms_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `sms_templates_templateKey_unique` UNIQUE(`templateKey`)
);
--> statement-breakpoint
CREATE TABLE `voicemail_sms_sent` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadPhone` varchar(20) NOT NULL,
	`leadName` varchar(255) NOT NULL,
	`smsLogId` int,
	`sentAt` bigint NOT NULL,
	CONSTRAINT `voicemail_sms_sent_id` PRIMARY KEY(`id`),
	CONSTRAINT `voicemail_sms_sent_leadPhone_unique` UNIQUE(`leadPhone`)
);
