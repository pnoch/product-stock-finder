CREATE TABLE `device_notification_configs` (
	`deviceId` varchar(128) NOT NULL,
	`alerts` json,
	`stockWatches` json,
	`dateReminders` json,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `device_notification_configs_deviceId` PRIMARY KEY(`deviceId`)
);
--> statement-breakpoint
CREATE TABLE `notification_events` (
	`id` varchar(128) NOT NULL,
	`deviceId` varchar(128) NOT NULL,
	`type` varchar(16) NOT NULL,
	`dedupKey` varchar(255) NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`payload` json,
	`createdAt` bigint NOT NULL,
	`deliveredAt` bigint,
	CONSTRAINT `notification_events_id` PRIMARY KEY(`id`)
);
