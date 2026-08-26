ALTER TABLE `app_settings` DROP FOREIGN KEY `app_settings_userId_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `back_order_reminders` DROP FOREIGN KEY `back_order_reminders_userId_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `device_notification_configs` DROP FOREIGN KEY `device_notification_configs_userId_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `device_push_tokens` DROP FOREIGN KEY `device_push_tokens_userId_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `notification_events` DROP FOREIGN KEY `notification_events_userId_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `price_alerts` DROP FOREIGN KEY `price_alerts_userId_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `watchlist_items` DROP FOREIGN KEY `watchlist_items_userId_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `app_settings` ADD CONSTRAINT `app_settings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `back_order_reminders` ADD CONSTRAINT `back_order_reminders_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `device_notification_configs` ADD CONSTRAINT `device_notification_configs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `device_push_tokens` ADD CONSTRAINT `device_push_tokens_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification_event_deliveries` ADD CONSTRAINT `notification_event_deliveries_eventId_notification_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `notification_events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification_events` ADD CONSTRAINT `notification_events_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `price_alerts` ADD CONSTRAINT `price_alerts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `watchlist_items` ADD CONSTRAINT `watchlist_items_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_reminders_user_updated` ON `back_order_reminders` (`userId`,`updatedAtMs`);--> statement-breakpoint
CREATE INDEX `idx_reminders_user_deleted` ON `back_order_reminders` (`userId`,`deletedAtMs`);--> statement-breakpoint
CREATE INDEX `idx_notif_events_created` ON `notification_events` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_notif_events_device` ON `notification_events` (`deviceId`);--> statement-breakpoint
CREATE INDEX `idx_alerts_user_updated` ON `price_alerts` (`userId`,`updatedAtMs`);--> statement-breakpoint
CREATE INDEX `idx_alerts_user_deleted` ON `price_alerts` (`userId`,`deletedAtMs`);--> statement-breakpoint
CREATE INDEX `idx_watchlist_user_updated` ON `watchlist_items` (`userId`,`updatedAtMs`);--> statement-breakpoint
CREATE INDEX `idx_watchlist_user_deleted` ON `watchlist_items` (`userId`,`deletedAtMs`);