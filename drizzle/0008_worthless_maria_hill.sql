CREATE TABLE `notification_event_deliveries` (
	`deviceId` varchar(128) NOT NULL,
	`eventId` varchar(128) NOT NULL,
	`deliveredAt` bigint NOT NULL,
	CONSTRAINT `notification_event_deliveries_deviceId_eventId_pk` PRIMARY KEY(`deviceId`,`eventId`)
);
--> statement-breakpoint
ALTER TABLE `device_notification_configs` ADD `userId` int;--> statement-breakpoint
ALTER TABLE `device_push_tokens` ADD `userId` int;--> statement-breakpoint
ALTER TABLE `notification_events` ADD `userId` int;--> statement-breakpoint
ALTER TABLE `device_notification_configs` ADD CONSTRAINT `device_notification_configs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `device_push_tokens` ADD CONSTRAINT `device_push_tokens_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification_events` ADD CONSTRAINT `notification_events_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;