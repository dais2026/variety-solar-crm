CREATE TABLE `solar_quotes_imports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadRef` varchar(20) NOT NULL,
	`leadName` varchar(255) NOT NULL,
	`leadEmail` varchar(255),
	`leadPhone` varchar(50),
	`emailUid` varchar(50),
	`importedAt` bigint NOT NULL,
	CONSTRAINT `solar_quotes_imports_id` PRIMARY KEY(`id`),
	CONSTRAINT `solar_quotes_imports_leadRef_unique` UNIQUE(`leadRef`)
);
--> statement-breakpoint
ALTER TABLE `sms_templates` ADD `name` varchar(255) NOT NULL;