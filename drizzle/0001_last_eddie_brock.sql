CREATE TABLE `app_settings` (
	`userId` int NOT NULL,
	`data` json NOT NULL,
	`updatedAtMs` bigint NOT NULL,
	`deletedAtMs` bigint,
	CONSTRAINT `app_settings_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
CREATE TABLE `back_order_reminders` (
	`userId` int NOT NULL,
	`reminderId` varchar(191) NOT NULL,
	`data` json NOT NULL,
	`updatedAtMs` bigint NOT NULL,
	`deletedAtMs` bigint,
	CONSTRAINT `back_order_reminders_userId_reminderId_pk` PRIMARY KEY(`userId`,`reminderId`)
);
--> statement-breakpoint
CREATE TABLE `price_alerts` (
	`userId` int NOT NULL,
	`alertId` varchar(191) NOT NULL,
	`data` json NOT NULL,
	`updatedAtMs` bigint NOT NULL,
	`deletedAtMs` bigint,
	CONSTRAINT `price_alerts_userId_alertId_pk` PRIMARY KEY(`userId`,`alertId`)
);
--> statement-breakpoint
CREATE TABLE `watchlist_items` (
	`userId` int NOT NULL,
	`productId` varchar(191) NOT NULL,
	`data` json NOT NULL,
	`updatedAtMs` bigint NOT NULL,
	`deletedAtMs` bigint,
	CONSTRAINT `watchlist_items_userId_productId_pk` PRIMARY KEY(`userId`,`productId`)
);
--> statement-breakpoint
ALTER TABLE `app_settings` ADD CONSTRAINT `app_settings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `back_order_reminders` ADD CONSTRAINT `back_order_reminders_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `price_alerts` ADD CONSTRAINT `price_alerts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `watchlist_items` ADD CONSTRAINT `watchlist_items_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;