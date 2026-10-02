CREATE TABLE `notification_webhook_log` (
	`userId` int NOT NULL,
	`dedupKey` varchar(255) NOT NULL,
	`sentAt` bigint NOT NULL,
	CONSTRAINT `notification_webhook_log_userId_dedupKey_pk` PRIMARY KEY(`userId`,`dedupKey`)
);
--> statement-breakpoint
ALTER TABLE `notification_webhook_log` ADD CONSTRAINT `notification_webhook_log_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_notif_webhook_user_sent` ON `notification_webhook_log` (`userId`,`sentAt`);--> statement-breakpoint
CREATE INDEX `idx_notif_webhook_sent` ON `notification_webhook_log` (`sentAt`);