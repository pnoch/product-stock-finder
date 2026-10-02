CREATE TABLE `notification_email_log` (
	`userId` int NOT NULL,
	`dedupKey` varchar(191) NOT NULL,
	`sentAt` bigint NOT NULL,
	CONSTRAINT `notification_email_log_userId_dedupKey_pk` PRIMARY KEY(`userId`,`dedupKey`)
);
--> statement-breakpoint
ALTER TABLE `notification_email_log` ADD CONSTRAINT `notification_email_log_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_notif_email_sent` ON `notification_email_log` (`sentAt`);