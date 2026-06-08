CREATE TABLE `npu_sms_sent` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadPhone` varchar(20) NOT NULL,
	`leadName` varchar(255) NOT NULL,
	`smsLogId` int,
	`sentAt` bigint NOT NULL,
	CONSTRAINT `npu_sms_sent_id` PRIMARY KEY(`id`),
	CONSTRAINT `npu_sms_sent_leadPhone_unique` UNIQUE(`leadPhone`)
);
