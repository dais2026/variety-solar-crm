CREATE TABLE `deleted_leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadName` varchar(255) NOT NULL,
	`leadPhone` varchar(20) NOT NULL,
	`reason` text,
	`deletedBy` varchar(255),
	`deletedAt` bigint NOT NULL,
	CONSTRAINT `deleted_leads_id` PRIMARY KEY(`id`)
);
